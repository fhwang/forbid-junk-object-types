// @ts-nocheck
interface OrderAndLineItemResult {
  orderId: string;
  lineItemId: string;
}

function getOrderResult(): OrderAndLineItemResult {
  return { orderId: '1', lineItemId: '2' };
}

function findOrderAndLineItem(params: { orderResult: OrderAndLineItemResult }) {
  return params.orderResult;
}
