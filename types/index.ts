export type OrderStatus = 'NEW' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED';

export type Order = {
  id: string;
  customerName: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
};
