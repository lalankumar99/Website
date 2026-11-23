/* ==========================================================================
   FILE: js/payment.js
   KAAM: Har baar naya Dynamic UPI QR Code banana, Direct UPI App link set
         karna, aur UTR + Device ID ke sath WhatsApp Verification bhejna.
   ========================================================================== */

// Abhi jo course kharida ja raha hai aur uska unique Order ID yahan store hoga
let currentPaymentState = {
  course: null,
  orderId: null
};

/* --------------------------------------------------------------------------
   1. PAYMENT INITIALIZATION (WHATSAPP VERIFY BUTTON SET KARNA)
   -------------------------------------------------------------------------- */
function initPayment() {
  const verifyBtn = document.getElementById('verify-whatsapp-btn');
  if (verifyBtn) {
    verifyBtn.addEventListener('click', sendWhatsAppVerification);
  }
}

/* --------------------------------------------------------------------------
   2. UNIQUE ORDER ID GENERATOR
   Har baar Buy Now dabane par alag Order ID banega (Jaise: PH-84921)
   taaki payment note me har transaction alag se pehchana ja sake.
   -------------------------------------------------------------------------- */
function generateOrderId() {
  const randomNum = Math.floor(10000 + Math.random() * 90000); // 5-digit random number
  return `PH-${randomNum}`;
}

/* --------------------------------------------------------------------------
   3. PAYMENT BOTTOM SHEET KHOLNA AUR DYNAMIC UPI QR BANANA
   courses.js me "Buy Now" button dabane par ye function call hota hai.
   -------------------------------------------------------------------------- */
function openPaymentSheet(courseId) {
  const course = AppState.courses.find((c) => c.id === courseId);
  if (!course) {
    showToast('Course nahi mila!');
    return;
  }

  // Config se tumhari UPI ID aur Payee Name nikalo
  const paymentConfig = AppState.config?.payment;
  if (!paymentConfig || !paymentConfig.upiId) {
    showToast('Payment settings load nahi hui hain.');
    return;
  }

  // Naya Order ID banao aur current state me save karo
  const orderId = generateOrderId();
  currentPaymentState = {
    course: course,
    orderId: orderId
  };

  // Bottom Sheet me Course ka naam, Price aur Order ID update karo
  document.getElementById('pay-course-title').textContent = course.title;
  document.getElementById('pay-amount').textContent = course.price;
  document.getElementById('qr-order-id').textContent = `Order: ${orderId}`;

  // Purana UTR input khali kar do
  const utrInput = document.getElementById('pay-utr');
  if (utrInput) utrInput.value = '';

  // ------------------------------------------------------------------------
  // STANDARD UPI DEEP LINK BANANA
  // pa = Tumhari UPI ID | pn = App Name | am = Exact Price | tn = Order ID
  // ------------------------------------------------------------------------
  const upiLink =
    `upi://pay?pa=${encodeURIComponent(paymentConfig.upiId)}` +
    `&pn=${encodeURIComponent(paymentConfig.payeeName || 'Polytechnic Hub')}` +
    `&am=${encodeURIComponent(course.price)}` +
    `&cu=${encodeURIComponent(paymentConfig.currency || 'INR')}` +
    `&tn=${encodeURIComponent(`${orderId} ${course.id}`)}`;

  // "Pay via UPI App" button par direct link set karo
  const directBtn = document.getElementById('upi-direct-btn');
  if (directBtn) {
    directBtn.href = upiLink;
  }

  // QR Box ko pehle saaf karo, phir naya QR Code draw karo
  const qrBox = document.getElementById('qr-box');
  if (qrBox) {
    qrBox.innerHTML = ''; // Purana QR hatao

    if (typeof QRCode !== 'undefined') {
      new QRCode(qrBox, {
        text: upiLink,
        width: 185,
        height: 185,
        colorDark: '#0F172A',     // Dark Slate QR pattern
        colorLight: '#FFFFFF',    // Pure White background (Scanner friendly)
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      qrBox.innerHTML = `<p style="font-size: 0.8rem; color: #DC2626;">QR Library load nahi hui. Niche UPI button use karein.</p>`;
    }
  }

  // Android Bottom Sheet open karo
  openSheet('payment-sheet');
}

/* --------------------------------------------------------------------------
   4. WHATSAPP VERIFICATION MESSAGE BHEJNA
   Student UTR number dal kar button dabayega, to uska Name, Mobile, Course,
   Order ID, UTR, aur Device ID apne aap format hokar WhatsApp me khulega.
   -------------------------------------------------------------------------- */
function sendWhatsAppVerification() {
  const utrInput = document.getElementById('pay-utr');
  const utr = utrInput ? utrInput.value.trim() : '';

  // 12-Digit UTR number check (kam se kam 10-12 characters hone chahiye)
  if (utr.length < 10) {
    showToast('Kripya sahi 12-digit UTR / Reference number dalein.');
    if (utrInput) utrInput.focus();
    return;
  }

  const { course, orderId } = currentPaymentState;
  const user = AppState.currentUser;
  const whatsappNumber = AppState.config?.payment?.whatsappNumber;

  if (!course || !user || !whatsappNumber) {
    showToast('Verification details adhoori hain.');
    return;
  }

  // Pre-filled WhatsApp message (Isme Device ID apne aap jud jayega!)
  const message =
    `*Polytechnic Hub - Course Unlock Request*\n` +
    `----------------------------\n` +
    `*Name:* ${user.name}\n` +
    `*Mobile:* ${user.mobile}\n` +
    `*Device ID:* ${AppState.deviceId}\n` +
    `*Course:* ${course.title} (${course.id})\n` +
    `*Amount:* Rs.${course.price}\n` +
    `*Order ID:* ${orderId}\n` +
    `*UTR No:* ${utr}\n` +
    `----------------------------\n` +
    `Please verify my payment and unlock my course.`;

  // WhatsApp URL kholna
  const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');

  showToast('WhatsApp par message bhej dein!');
  closeSheet('payment-sheet');
}
