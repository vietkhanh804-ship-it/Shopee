const fmt = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const nfmt = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

const defaults = {
  phone: { price: 10000000, voucher: 200000, cost: 8500000, ads: 150000, target: 500000, shipping: 0, bankPromo: 0, transactionRate: 6, infrastructure: 3000, extraFee: 0, extraRate: 0, other: 0 },
  accessory: { price: 250000, voucher: 20000, cost: 110000, ads: 15000, target: 50000, shipping: 0, bankPromo: 0, transactionRate: 6, infrastructure: 3000, extraFee: 0, extraRate: 0, other: 0 }
};

const mainFields = [
  ['price', 'Giá bán niêm yết', 'đ'], ['voucher', 'Voucher của shop', 'đ'],
  ['cost', 'Giá nhập sản phẩm', 'đ'], ['ads', 'Chi phí quảng cáo / đơn', 'đ'],
  ['target', 'Lợi nhuận mong muốn', 'đ']
];
const advancedFields = [
  ['transactionRate', 'Phí xử lý giao dịch', '%'], ['infrastructure', 'Phí hạ tầng / đơn', 'đ'],
  ['shipping', 'Phí ship người mua trả', 'đ'], ['bankPromo', 'Khuyến mãi ngân hàng', 'đ'],
  ['extraRate', 'Phí dịch vụ khác', '%'], ['extraFee', 'Phí sàn khác / đơn', 'đ'],
  ['other', 'Chi phí khác / đơn', 'đ']
];

const state = loadState();
const shopType = document.querySelector('#shopType');
const accessoryCategory = document.querySelector('#accessoryCategory');
shopType.value = state.shopType || 'normal';
accessoryCategory.value = state.accessoryCategory || 'common';

document.querySelectorAll('.calculator').forEach(buildCalculator);
shopType.addEventListener('change', () => { state.shopType = shopType.value; updateAll(); });
accessoryCategory.addEventListener('change', () => { state.accessoryCategory = accessoryCategory.value; updateAll(); });
document.querySelector('#resetAll').addEventListener('click', () => {
  if (!confirm('Đặt lại toàn bộ số liệu về ví dụ ban đầu?')) return;
  localStorage.removeItem('shopee-profit-dashboard-v2');
  location.reload();
});
updateAll();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('shopee-profit-dashboard-v2') || '{}');
    return {
      shopType: saved.shopType || 'normal', accessoryCategory: saved.accessoryCategory || 'common',
      phone: { ...defaults.phone, ...(saved.phone || {}) },
      accessory: { ...defaults.accessory, ...(saved.accessory || {}) }
    };
  } catch { return { shopType: 'normal', accessoryCategory: 'common', phone: { ...defaults.phone }, accessory: { ...defaults.accessory } }; }
}

function fieldMarkup(kind, [key, label, unit]) {
  return `<div class="field"><label for="${kind}-${key}">${label}</label><div class="input-shell"><input id="${kind}-${key}" inputmode="decimal" data-key="${key}" value="${state[kind][key]}" aria-label="${label}"><span>${unit}</span></div></div>`;
}

function buildCalculator(card) {
  const kind = card.dataset.kind;
  card.querySelector('.input-grid').innerHTML = mainFields.map(f => fieldMarkup(kind, f)).join('');
  card.querySelector('.advanced-grid').innerHTML = advancedFields.map(f => fieldMarkup(kind, f)).join('');
  card.querySelectorAll('input').forEach(input => {
    input.value = displayInput(input.dataset.key, state[kind][input.dataset.key]);
    input.addEventListener('focus', () => input.value = String(state[kind][input.dataset.key] || 0));
    input.addEventListener('input', () => {
      state[kind][input.dataset.key] = Math.max(0, parseNumber(input.value));
      updateAll(false);
    });
    input.addEventListener('blur', () => input.value = displayInput(input.dataset.key, state[kind][input.dataset.key]));
  });
}

function parseNumber(value) { return Number(String(value).replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0; }
function displayInput(key, value) { return key.toLowerCase().includes('rate') ? nfmt.format(value) : new Intl.NumberFormat('vi-VN').format(value); }

function categoryRate(kind) {
  const mall = state.shopType === 'mall';
  if (kind === 'phone') return mall ? 2.5 : 2;
  const map = { common: mall ? 17.7 : 15, memory: mall ? 15.6 : 13, watch: mall ? 16.5 : 15 };
  return map[state.accessoryCategory] || map.common;
}

function calculate(kind) {
  const d = state[kind];
  const fixedRate = categoryRate(kind) / 100;
  const transactionRate = d.transactionRate / 100;
  const extraRate = d.extraRate / 100;
  const netProduct = Math.max(0, d.price - d.voucher);
  const transactionBase = Math.max(0, d.price + d.shipping - d.voucher - d.bankPromo);
  const fixedFee = netProduct * fixedRate;
  const transactionFee = transactionBase * transactionRate;
  const serviceFee = netProduct * extraRate;
  const totalPlatform = fixedFee + transactionFee + d.infrastructure + serviceFee + d.extraFee;
  const profit = netProduct - d.cost - d.ads - d.other - totalPlatform;
  const margin = netProduct > 0 ? profit / netProduct * 100 : 0;
  const denominator = 1 - fixedRate - transactionRate - extraRate;
  const breakEven = denominator > 0 ? d.voucher + (d.cost + d.ads + d.other + d.infrastructure + d.extraFee + transactionRate * d.shipping - transactionRate * d.bankPromo) / denominator : 0;
  const targetPrice = denominator > 0 ? d.voucher + (d.target + d.cost + d.ads + d.other + d.infrastructure + d.extraFee + transactionRate * d.shipping - transactionRate * d.bankPromo) / denominator : 0;
  return { fixedRate, netProduct, fixedFee, transactionFee, serviceFee, totalPlatform, profit, margin, breakEven, targetPrice };
}

function updateAll(save = true) {
  ['phone', 'accessory'].forEach(kind => renderResult(kind, calculate(kind)));
  if (save) localStorage.setItem('shopee-profit-dashboard-v2', JSON.stringify(state));
  else localStorage.setItem('shopee-profit-dashboard-v2', JSON.stringify(state));
}

function renderResult(kind, r) {
  const card = document.querySelector(`.calculator[data-kind="${kind}"]`);
  card.querySelector('[data-role="category-rate-label"]').textContent = `${nfmt.format(r.fixedRate * 100)}%`;
  const profitClass = r.profit < 0 ? 'negative' : '';
  const marginText = `${r.margin >= 0 ? '+' : ''}${nfmt.format(r.margin)}% biên lợi nhuận`;
  card.querySelector('.result-panel').innerHTML = `
    <div class="profit-line"><div><span>LỢI NHUẬN ƯỚC TÍNH / ĐƠN</span><strong class="${profitClass}">${fmt.format(r.profit)}</strong></div><div class="margin-badge">${marginText}</div></div>
    <div class="fee-lines">
      <div><span>Doanh thu sau voucher</span><b>${fmt.format(r.netProduct)}</b></div>
      <div><span>Phí cố định (${nfmt.format(r.fixedRate * 100)}%)</span><b>− ${fmt.format(r.fixedFee)}</b></div>
      <div><span>Phí xử lý (${nfmt.format(state[kind].transactionRate)}%)</span><b>− ${fmt.format(r.transactionFee)}</b></div>
      <div><span>Phí hạ tầng</span><b>− ${fmt.format(state[kind].infrastructure)}</b></div>
      ${r.serviceFee ? `<div><span>Phí dịch vụ khác</span><b>− ${fmt.format(r.serviceFee)}</b></div>` : ''}
      ${state[kind].extraFee ? `<div><span>Phí sàn khác</span><b>− ${fmt.format(state[kind].extraFee)}</b></div>` : ''}
      <div class="total"><span>Tổng phí Shopee</span><b>− ${fmt.format(r.totalPlatform)}</b></div>
    </div>
    <div class="price-suggest">
      <div><span>Giá niêm yết hòa vốn</span><b>${fmt.format(Math.ceil(r.breakEven / 1000) * 1000)}</b></div>
      <div><span>Giá để đạt lãi ${fmt.format(state[kind].target)}</span><b>${fmt.format(Math.ceil(r.targetPrice / 1000) * 1000)}</b></div>
    </div>`;
}
