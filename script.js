/* ============================================================
   EMAILJS SETUP — fill these in before the "Place Order" button
   will actually send emails. See the notes at the bottom of this
   file for a step-by-step guide.
   ============================================================ */
const EMAILJS_PUBLIC_KEY   = "XwQhLDM3QnrstIw-O";     // Account > General
const EMAILJS_SERVICE_ID   = "service_jx5qrw8";     // Email Services
const EMAILJS_TEMPLATE_USER  = "ldcqjsi";  // sent to the customer
const EMAILJS_TEMPLATE_ADMIN = "n1m7bvl"; // sent to you
const ADMIN_EMAIL = "shiraksha1@gmail.com";

if (window.emailjs && EMAILJS_PUBLIC_KEY !== "YOUR_PUBLIC_KEY") {
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
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

  sendOrderBtn.textContent = 'Placing order…';
  sendOrderBtn.setAttribute('aria-disabled', 'true');

  try {
    // Email to the admin: order + payment details
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ADMIN, {
      to_email: ADMIN_EMAIL,
      customer_name: name,
      branch: branch,
      mobile: mobile,
      customer_email: email,
      item: label,
      quantity: qty,
      total: `₹${total}`,
      advance: `₹${advance}`,
      payment_method: paymentMethod,
      transaction_id: isOnline ? txnId : 'N/A (Cash on Delivery)'
    });

    // Confirmation email to the customer
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_USER, {
      to_email: email,
      to_name: name
    });

    showToast('Order placed! Check your email for confirmation.');
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

/* ============================================================
   SETUP GUIDE — do this once, in this order:

   1. Create a free account at https://www.emailjs.com
   2. Email Services -> Add a service (e.g. connect your Gmail) ->
      copy the Service ID into EMAILJS_SERVICE_ID above.
   3. Account -> General -> copy your Public Key into
      EMAILJS_PUBLIC_KEY above.
   4. Email Templates -> create TWO templates:

      a) "Admin" template (sent to you):
         To email:   {{to_email}}
         Subject:    New order — Ruviksha
         Body should reference: {{customer_name}}, {{branch}},
         {{mobile}}, {{customer_email}}, {{item}}, {{quantity}},
         {{total}}, {{advance}}, {{payment_method}}, {{transaction_id}}
         Copy this template's ID into EMAILJS_TEMPLATE_ADMIN above.

      b) "Customer confirmation" template (sent to the buyer):
         To email: {{to_email}}
         Subject:  Order Successfully Placed
         Body:
            Hi,
            Thank you for your order!
            We're happy to let you know that your order has been
            successfully placed and is now being processed.
            If you have any questions, feel free to reply to this email.
            Thank you for shopping with us!
            Best regards,
            The Support Team
         Copy this template's ID into EMAILJS_TEMPLATE_USER above.
   ============================================================ */