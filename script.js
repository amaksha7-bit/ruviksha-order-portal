const EMAILJS_PUBLIC_KEY   = "XwQhLDM3QnrstIw-O";     // Account > General
const EMAILJS_SERVICE_ID   = "service_jx5qrw8";     // Email Services
const EMAILJS_TEMPLATE_USER  = "template_bcrkuct";  // sent to the customer
const EMAILJS_TEMPLATE_ADMIN = "template_0n1jzhy"; // sent to you
const ADMIN_EMAIL = "shiraksha1@gmail.com";

const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbz531_tBgakAFeYNKWx7dLi3hxS7ONYmm8h-t-RfrLCTS4eVKvhcsmbEIED8w7FIrVqEg/exec";

if (window.emailjs && EMAILJS_PUBLIC_KEY !== "YOUR_PUBLIC_KEY") {
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

/* ---------------- log order to Google Sheet (for admin dashboard) ---------------- */
function sendOrderToSheet(data){
  if (!SHEET_API_URL || SHEET_API_URL.includes('PASTE_YOUR')) return;
  // text/plain avoids a CORS preflight request, which Apps Script doesn't handle.
  fetch(SHEET_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'addOrder', ...data })
  }).catch(err => console.error('Sheet logging failed (order still placed fine):', err));
}

/* ---------------- unique order id ---------------- */
function generateOrderId(){
  const now = new Date();
  const datePart = now.toISOString().slice(2,10).replace(/-/g,''); // YYMMDD
  const randPart = Math.random().toString(36).slice(2,6).toUpperCase();
  return `RVS-${datePart}-${randPart}`; // e.g. RVS-260810-K3F9
}

/* ---------------- order type / quantity / price logic ---------------- */
const typeRow = document.getElementById('orderTypeRow');
const chips = typeRow.querySelectorAll('.radio-chip');
const qtyField = document.getElementById('qtyField');
const qtyInput = document.getElementById('qty');
const pageQtyField = document.getElementById('pageQtyField');
const pageQtyInput = document.getElementById('pageQty');

const sumItem = document.getElementById('sumItem');
const sumQty = document.getElementById('sumQty');
const sumAdvance = document.getElementById('sumAdvance');
const sumTotal = document.getElementById('sumTotal');

const paymentMethodRow = document.getElementById('paymentMethodRow');
const paymentChips = paymentMethodRow.querySelectorAll('.radio-chip');
const onlinePaymentBlock = document.getElementById('onlinePaymentBlock');
const cashPaymentBlock = document.getElementById('cashPaymentBlock');
const txnIdInput = document.getElementById('txnId');

function updatePaymentMethod(){
  paymentChips.forEach(c => c.classList.toggle('active', c.querySelector('input').checked));
  const isOnline = paymentMethodRow.querySelector('input[value="Online Payment"]').checked;
  onlinePaymentBlock.style.display = isOnline ? 'block' : 'none';
  cashPaymentBlock.style.display = isOnline ? 'none' : 'flex';
}
paymentMethodRow.addEventListener('change', updatePaymentMethod);
updatePaymentMethod();

const PAGE_RATE = 1.5;   // ₹ per page (₹15 / 10 pages)
const PAGE_MIN = 10;
const PAGE_MAX = 50;     // max pages a single user can order per day

function clampPages(){
  let v = Math.round(Number(pageQtyInput.value) / 10) * 10;
  if (isNaN(v) || v < PAGE_MIN) v = PAGE_MIN;
  if (v > PAGE_MAX) v = PAGE_MAX;
  pageQtyInput.value = v;
  return v;
}

function currentOrder(){
  const active = typeRow.querySelector('input[name="type"]:checked');
  const isPages = active.value === 'Pages Only';

  if (isPages){
    const pages = clampPages();
    const total = Math.round(pages * PAGE_RATE);
    return {
      label: `Pages Only (${pages} pages)`,
      qty: 1,
      total
    };
  }

  const chip = active.closest('.radio-chip');
  const unitPrice = Number(chip.dataset.price);
  const qty = Math.max(1, Number(qtyInput.value) || 1);
  return {
    label: chip.dataset.label,
    qty,
    total: unitPrice * qty
  };
}

function updateSummary(){
  chips.forEach(c => c.classList.toggle('active', c.querySelector('input').checked));
  const isPages = typeRow.querySelector('input[value="Pages Only"]').checked;

  pageQtyField.style.display = isPages ? 'block' : 'none';
  qtyField.style.display = isPages ? 'none' : 'block';

  const { label, qty, total } = currentOrder();
  sumItem.textContent = label;
  sumQty.textContent = qty;
  sumTotal.textContent = `₹${total}`;
  sumAdvance.textContent = `₹${Math.ceil(total / 2)}`;
}

typeRow.addEventListener('change', updateSummary);
pageQtyInput.addEventListener('change', updateSummary);
pageQtyInput.addEventListener('input', updateSummary);
qtyInput.addEventListener('input', updateSummary);
updateSummary();

/* ---------------- toast ---------------- */
const toast = document.getElementById('toast');
function showToast(msg){
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

/* ---------------- place order ---------------- */
const sendOrderBtn = document.getElementById('sendOrder');

sendOrderBtn.addEventListener('click', async function(e){
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const branch = document.getElementById('branch').value.trim();
  const mobile = document.getElementById('mobile').value.trim();
  const email = document.getElementById('email').value.trim();
  const agreed = document.getElementById('agreeTerms').checked;
  const paymentMethod = paymentMethodRow.querySelector('input[name="paymentMethod"]:checked').value;
  const isOnline = paymentMethod === 'Online Payment';
  const txnId = txnIdInput.value.trim();

  if (!name || !branch || !mobile || !email){
    showToast('Fill in your name, branch, mobile number and email first.');
    return;
  }
  if (!agreed){
    showToast('Please read and accept the terms & policies first.');
    return;
  }
  if (isOnline && !txnId){
    showToast('Please enter your payment Transaction ID.');
    return;
  }

  if (!window.emailjs || EMAILJS_PUBLIC_KEY === "YOUR_PUBLIC_KEY"){
    showToast('Ordering isn\'t connected yet — see script.js setup notes.');
    return;
  }

  const { label, qty, total } = currentOrder();
  const advance = Math.ceil(total / 2);
  const orderId = generateOrderId();

  const isPagesOrder = typeRow.querySelector('input[value="Pages Only"]').checked;
  const pagesText = isPagesOrder ? `${pageQtyInput.value} pages` : 'N/A';
  const paymentStatusText = isOnline
    ? 'Payment received — pending verification'
    : 'Cash on delivery (full amount due before delivery)';
  const deliveryTimeText = '2 days';

  // Advance shown to admin must reflect reality: for online payment the
  // customer has actually paid (via UPI + txn id); for COD nothing has
  // been paid yet, so don't show it as "paid".
  const advanceText = isOnline
    ? `₹${advance} (paid via UPI)`
    : `₹0 (not paid yet — Cash on Delivery, full amount due before delivery)`;

  sendOrderBtn.textContent = 'Placing order…';
  sendOrderBtn.setAttribute('aria-disabled', 'true');

  try {
    // Log the order to the Google Sheet for the admin dashboard
    sendOrderToSheet({
      orderId,
      name,
      branch,
      mobile,
      email,
      item: label,
      quantity: qty,
      total,
      paymentMethod,
      transactionId: isOnline ? txnId : 'N/A (Cash on Delivery)',
      paymentStatus: paymentStatusText
    });

    // Email to the admin: order + payment details
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ADMIN, {
      order_id: orderId,
      to_email: ADMIN_EMAIL,
      customer_name: name,
      branch: branch,
      mobile: mobile,
      customer_email: email,
      item: label,
      quantity: qty,
      total: `₹${total}`,
      advance: advanceText,
      payment_method: paymentMethod,
      transaction_id: isOnline ? txnId : 'N/A (Cash on Delivery)'
    });

    // Confirmation email to the customer
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_USER, {
      order_id: orderId,
      to_email: email,
      to_name: name,
      file_type: label,
      quantity: qty,
      pages: pagesText,
      payment_method: paymentMethod,
      total_amount: total,
      payment_status: paymentStatusText,
      delivery_time: deliveryTimeText
    });

    showToast(`Order placed! Your Order ID is ${orderId} — check your email for confirmation.`);
    document.getElementById('orderForm').reset();
    updateSummary();
    updatePaymentMethod();
  } catch (err){
    console.error(err);
    showToast('Something went wrong sending your order. Please try again.');
  } finally {
    sendOrderBtn.textContent = 'Place Order';
    sendOrderBtn.removeAttribute('aria-disabled');
  }
});
