import { ProductVariant } from '@vendure/core';

export interface ProductInput {
  name: string;
  idvatgroup: number;
  productcode: string;
  price: number;
  description?: string;
  barcode?: string;
  active?: boolean;
}

export interface VatGroup {
  idvatgroup: number;
  name: string;
  percentage: number;
}

export type VariantWithStock = Pick<
  ProductVariant,
  'id' | 'sku' | 'stockAllocated' | 'stockOnHand'
>;

export interface Webhook {
  idhook: number;
  name: string;
  event: 'products.free_stock_changed' | 'orders.completed';
  address: string;
  active: boolean;
  secret: boolean | string;
}

export interface WebhookInput {
  name: string;
  event: 'products.free_stock_changed' | 'orders.completed';
  address: string;
  secret: string;
}

export type IncomingWebhook = IncomingProductWebhook; // TODO | IncomingOrderWebhook;

export interface IncomingProductWebhook {
  idhook: number;
  name: string;
  event: string;
  event_triggered_at: string;
  data: ProductData;
}

export interface ProductData {
  idproduct: number;
  idvatgroup: number;
  idsupplier: any;
  productcode: string;
  name: string;
  price: number;
  fixedstockprice: number;
  productcode_supplier: string;
  deliverytime: any;
  description: string;
  barcode: string;
  type: string;
  unlimitedstock: boolean;
  weight: number;
  minimum_purchase_quantity: number;
  purchase_in_quantities_of: number;
  hs_code: any;
  country_of_origin: any;
  active: boolean;
  productfields: Productfield[];
  images: string[];
  stock: Stock[];
}

export interface Productfield {
  idproductfield: number;
  title: string;
  value: string;
}

export interface Stock {
  idwarehouse: number;
  stock: number;
  reserved: number;
  reservedbackorders: number;
  reservedpicklists: number;
  reservedallocations: number;
  freestock: number;
  freepickablestock: number;
}

export interface CustomerData {
  idcustomer: number;
  idtemplate: any;
  customerid: string;
  name: string;
  contactname: string;
  telephone: string;
  emailaddress: string;
  discount: number;
  vatnumber: string;
  calculatevat: boolean;
  default_order_remarks: string;
  auto_split: boolean;
  language: string;
  addresses: AddressData[];
}

export interface AddressData {
  idcustomer_address: number;
  name: string;
  contactname: any;
  address: string;
  address2: any;
  zipcode: string;
  city: string;
  region: any;
  country: string;
  defaultinvoice: boolean;
  defaultdelivery: boolean;
}

export interface CustomerInput {
  name: string;
  contactname?: string;
  telephone?: string;
  emailaddress?: string;
  addresses?: AddressInput[];
}

export interface AddressInput {
  name: string;
  address?: string;
  zipcode?: string;
  city?: string;
  region?: any;
  country?: string;
  defaultinvoice?: boolean;
  defaultdelivery?: boolean;
}

export interface OrderData {
  idorder: number;
  idcustomer: number;
  idtemplate: number;
  idshippingprovider_profile: any;
  orderid: string;
  deliveryname: string;
  deliverycontactname: string;
  deliveryaddress: string;
  deliveryaddress2: any;
  deliveryzipcode: string;
  deliverycity: string;
  deliveryregion: any;
  deliverycountry: string;
  full_delivery_address: string;
  invoicename: string;
  invoicecontactname: string;
  invoiceaddress: string;
  invoiceaddress2: any;
  invoicezipcode: string;
  invoicecity: string;
  invoiceregion: any;
  invoicecountry: string;
  full_invoice_address: string;
  telephone: any;
  emailaddress: any;
  reference: any;
  customer_remarks: any;
  pickup_point_data: any;
  partialdelivery: boolean;
  auto_split: boolean;
  invoiced: boolean;
  preferred_delivery_date: any;
  discount: number;
  calculatevat: boolean;
  status: string;
  public_status_page: string;
  created: string;
  updated: string;
  warehouses: number[];
  products: Product[];
  pricelists: number[];
}

export interface Product {
  idorder_product: number;
  idproduct: number;
  idvatgroup: number;
  productcode: string;
  name: string;
  remarks: string;
  price: number;
  amount: number;
  amount_cancelled: number;
  weight: number;
  partof_idorder_product: any;
  has_parts: boolean;
}

export interface OrderInput {
  idcustomer: number;
  reference: string;
  deliveryname?: string;
  deliverycontactname?: string;
  deliveryaddress?: string;
  deliveryaddress2?: string;
  deliveryzipcode?: string;
  deliverycity?: string;
  deliveryregion?: string;
  deliverycountry?: string;
  invoicename?: string;
  invoicecontactname?: string;
  invoiceaddress?: string;
  invoiceaddress2?: any;
  invoicezipcode?: string;
  invoicecity?: string;
  invoiceregion?: string;
  invoicecountry?: string;
  products: OrderProductInput[];
}

export interface OrderProductInput {
  idproduct: number;
  amount: number;
}
