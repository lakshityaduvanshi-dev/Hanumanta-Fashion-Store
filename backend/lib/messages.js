// Text of the emails sent to customers. Each returns [subject, body].
const cfg = require("../config");
const track = () => cfg.appUrl ? `\n\nTrack your order: ${cfg.appUrl}` : "";
const hi = o => `Hello ${o.customer.name},\n\n`;
const sign = store => `\n\nThank you,\n${store}`;
module.exports = {
  confirmed: (o, store) => [`Order ${o.orderId} is confirmed`, hi(o) + `Your order ${o.orderId} is confirmed. Total ₹${o.total}, pay by cash on delivery. We will pack it soon.` + track() + sign(store)],
  out: (o, store, x) => [`Order ${o.orderId} is out for delivery`, hi(o) + `Your order ${o.orderId} is out for delivery with ${x.partner.name} (${x.partner.phone}). Please keep ₹${o.total} ready.\n\nYour delivery code is ${x.otp}. Give this code to the delivery partner only when you receive your order.` + track() + sign(store)],
  delivered: (o, store) => [`Order ${o.orderId} was delivered`, hi(o) + `Your order ${o.orderId} was delivered. We hope you love it! If something is wrong, you can request a return from My orders.` + track() + sign(store)],
  cancelled: (o, store) => [`Order ${o.orderId} was cancelled`, hi(o) + `Your order ${o.orderId} was cancelled. If you did not ask for this, please contact us.` + sign(store)],
  failed: (o, store, x) => [`We could not deliver order ${o.orderId}`, hi(o) + `We could not deliver your order ${o.orderId}. Reason: ${x.reason}. Please contact us if you still want it.` + sign(store)],
  returnApproved: (o, store, x) => [`Return approved for order ${o.orderId}`, hi(o) + `Your return request for order ${o.orderId} is approved.${x.note ? "\n\nNote from the store: " + x.note : ""}` + track() + sign(store)],
  returnRejected: (o, store, x) => [`Return request for order ${o.orderId}`, hi(o) + `We are sorry, we could not approve your return request for order ${o.orderId}.\n\nReason: ${x.note}` + sign(store)],
  returnRefunded: (o, store, x) => [`Refund sent for order ${o.orderId}`, hi(o) + `We have sent your refund of ₹${x.amount} to ${x.refundTo}.\nPayment reference: ${x.note}` + sign(store)]
};
