import { useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

const LOGO_URL =
  "https://cdn.shopify.com/s/files/1/0483/3758/4295/files/Joy_Wholefoods_-_Primary_Logo_-_Dark.png?v=1775531358";

const SUPPORT_PHONE = "0480 079 218";

type PrintMode = "labels" | "localPackingSlip" | "courierPackingSlip" | "checklist";

type CustomAttribute = {
  key: string;
  value: string;
};

type DriverDetails = {
  name: string;
  phone: string;
  vehicleNumber: string;
  vehicleType: string;
};

type LineItem = {
  id: string;
  title: string;
  productTitle: string;
  quantity: number;
  currentQuantity: number;
  unfulfilledQuantity: number;
  variantTitle: string;
  productType: string;
  tags: string[];
};

type Order = {
  id: string;
  name: string;
  createdAt: string;
  note: string;
  customerName: string;
  address: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone: string;

  deliveryMethod: string;
  customerTimeZone: string;
  deliveryPostalCode: string;
  locationId: string;
  shopifyLocationId: string;
  deliveryDate: string;
  deliveryDay: string;

  checkoutMethod: string;
  deliveryLocation: string;

  pickupLocationId: string;
  pickupLocationCompany: string;
  pickupLocationAddressLine1: string;
  pickupLocationCity: string;
  pickupLocationRegion: string;
  pickupLocationPostalCode: string;
  pickupLocationCountry: string;

  pickupDetails: string;
  driverName: string;
  driverPhone: string;
  vehicleNumber: string;
  vehicleType: string;
  packingInstructions: string;
  lineItems: LineItem[];
};

export const loader = async ({ request }: { request: Request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query GetOrders {
      orders(first: 50, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            createdAt
            note

            customer {
              firstName
              lastName
              email
              phone
            }

            shippingAddress {
              name
              address1
              address2
              city
              province
              country
              zip
              phone
            }

            customAttributes {
              key
              value
            }

            packingInstructionsMetafield: metafield(namespace: "custom", key: "packing_instructions") {
              value
            }

            driverDetailsMetafield: metafield(namespace: "custom", key: "driver_details") {
              value
            }

            lineItems(first: 100) {
              edges {
                node {
                  id
                  title
                  quantity
                  currentQuantity
                  unfulfilledQuantity
                  variantTitle
                  product {
                    title
                    productType
                    tags
                  }
                }
              }
            }
          }
        }
      }
    }
  `);

  const data = await response.json();

  if (data?.errors) {
    console.error("Shopify GraphQL errors:", JSON.stringify(data.errors, null, 2));
  }

  const orders: Order[] =
    data?.data?.orders?.edges?.map((edge: any) => {
      const order = edge.node;
      const shipping = order.shippingAddress;

      const assignedDriver = parseDriverDetails(order.driverDetailsMetafield?.value);

      const deliveryMethod = getOrderValue(order, "Delivery Method", [
        "Delivery Method",
        "delivery_method",
        "deliveryMethod",
        "delivery-method",
      ]);

      const customerTimeZone = getOrderValue(order, "Customer TimeZone", [
        "Customer TimeZone",
        "Customer Timezone",
        "customer_timezone",
        "customerTimeZone",
        "customer-timezone",
      ]);

      const deliveryPostalCode = getOrderValue(order, "Delivery Postal Code", [
        "Delivery Postal Code",
        "delivery_postal_code",
        "deliveryPostalCode",
        "delivery-postal-code",
      ]);

      const locationId = getOrderValue(order, "locationId", [
        "locationId",
        "locationid",
        "Location ID",
        "Location Id",
        "location_id",
        "location-id",
      ]);

      const shopifyLocationId = getOrderValue(order, "shopifyLocationId", [
        "shopifyLocationId",
        "shopifylocationid",
        "Shopify Location ID",
        "Shopify Location Id",
        "shopify_location_id",
        "shopify-location-id",
      ]);

      const deliveryDate = getOrderValue(order, "Delivery Date", [
        "Delivery Date",
        "delivery_date",
        "deliveryDate",
        "delivery-date",
      ]);

      const deliveryDay = getOrderValue(order, "Delivery Day", [
        "Delivery Day",
        "delivery_day",
        "deliveryDay",
        "delivery-day",
      ]);

      const checkoutMethod = getOrderValue(order, "Checkout-Method", [
        "Checkout-Method",
        "Checkout Method",
        "checkout_method",
        "checkoutMethod",
      ]);

      const deliveryLocation = getOrderValue(order, "Delivery Location", [
        "Delivery Location",
        "delivery_location",
        "deliveryLocation",
        "delivery-location",
      ]);

      const pickupLocationId = getOrderValue(order, "Pickup-Location-Id", [
        "Pickup-Location-Id",
        "Pickup Location Id",
        "Pickup Location ID",
        "pickup_location_id",
        "pickupLocationId",
      ]);

      const pickupLocationCompany = getOrderValue(order, "Pickup-Location-Company", [
        "Pickup-Location-Company",
        "Pickup Location Company",
        "pickup_location_company",
        "pickupLocationCompany",
      ]);

      const pickupLocationAddressLine1 = getOrderValue(
        order,
        "Pickup-Location-Address-Line-1",
        [
          "Pickup-Location-Address-Line-1",
          "Pickup Location Address Line 1",
          "pickup_location_address_line_1",
          "pickupLocationAddressLine1",
        ],
      );

      const pickupLocationCity = getOrderValue(order, "Pickup-Location-City", [
        "Pickup-Location-City",
        "Pickup Location City",
        "pickup_location_city",
        "pickupLocationCity",
      ]);

      const pickupLocationRegion = getOrderValue(order, "Pickup-Location-Region", [
        "Pickup-Location-Region",
        "Pickup Location Region",
        "pickup_location_region",
        "pickupLocationRegion",
      ]);

      const pickupLocationPostalCode = getOrderValue(
        order,
        "Pickup-Location-Postal-Code",
        [
          "Pickup-Location-Postal-Code",
          "Pickup Location Postal Code",
          "pickup_location_postal_code",
          "pickupLocationPostalCode",
        ],
      );

      const pickupLocationCountry = getOrderValue(order, "Pickup-Location-Country", [
        "Pickup-Location-Country",
        "Pickup Location Country",
        "pickup_location_country",
        "pickupLocationCountry",
      ]);

      const pickupDetails = getOrderValue(order, "Pickup Details", [
        "Pickup Details",
        "pickup_details",
        "pickupDetails",
        "pickup-details",
      ]);

      const easyRoutesDriverName = getOrderValue(order, "EasyRoutes Driver", [
        "EasyRoutes Driver",
        "easyroutes driver",
        "Driver",
        "driver",
        "Driver Name",
        "driver_name",
        "driverName",
      ]);

      const packingInstructions =
        order.packingInstructionsMetafield?.value ||
        getOrderValue(order, "Packing Instructions", [
          "Packing Instructions",
          "packing_instructions",
          "packingInstructions",
          "packing-instructions",
          "Instructions",
          "instruction",
        ]);

      const lineItems: LineItem[] =
        order.lineItems?.edges?.map((lineEdge: any) => {
          const item = lineEdge.node;

          return {
            id: item.id,
            title: item.title || item.product?.title || "",
            productTitle: item.product?.title || item.title || "",
            quantity: Number(item.quantity || 0),
            currentQuantity: Number(item.currentQuantity || 0),
            unfulfilledQuantity: Number(item.unfulfilledQuantity || 0),
            variantTitle: item.variantTitle || "",
            productType: item.product?.productType || "",
            tags: item.product?.tags || [],
          };
        }) || [];

      return {
        id: order.id,
        name: order.name,
        createdAt: order.createdAt,
        note: order.note || "",

        customerName:
          shipping?.name ||
          `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim(),

        address: [shipping?.address1, shipping?.address2].filter(Boolean).join(", "),

        city: shipping?.city || "",
        province: shipping?.province || "",
        country: shipping?.country || "",
        zip: shipping?.zip || "",
        phone: shipping?.phone || order.customer?.phone || "",

        deliveryMethod,
        customerTimeZone,
        deliveryPostalCode,
        locationId,
        shopifyLocationId,
        deliveryDate,
        deliveryDay,

        checkoutMethod,
        deliveryLocation,

        pickupLocationId,
        pickupLocationCompany,
        pickupLocationAddressLine1,
        pickupLocationCity,
        pickupLocationRegion,
        pickupLocationPostalCode,
        pickupLocationCountry,

        pickupDetails,
        driverName: assignedDriver.name || easyRoutesDriverName,
        driverPhone: assignedDriver.phone,
        vehicleNumber: assignedDriver.vehicleNumber,
        vehicleType: assignedDriver.vehicleType,
        packingInstructions,
        lineItems,
      };
    }) || [];

  return { orders };
};

export default function Index() {
  const { orders } = useLoaderData() as { orders: Order[] };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ordersLimit, setOrdersLimit] = useState("20");
  const [printMode, setPrintMode] = useState<PrintMode>("labels");

  const visibleOrders = useMemo(() => {
    return orders.slice(0, Number(ordersLimit));
  }, [orders, ordersLimit]);

  const selectedOrders = useMemo(() => {
    return visibleOrders.filter((order) => selectedIds.includes(order.id));
  }, [visibleOrders, selectedIds]);

  const ordersWithDriver = useMemo(() => {
    return orders.filter((order) => order.driverName).length;
  }, [orders]);

  const toggleOrder = (orderId: string) => {
    setSelectedIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId],
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === visibleOrders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(visibleOrders.map((order) => order.id));
    }
  };

  const handlePrint = () => {
    if (selectedOrders.length === 0) {
      alert("Please select at least one order.");
      return;
    }

    window.print();
  };

  const printButtonLabel = getPrintButtonLabel(printMode);

  return (
    <div className={`app-root print-mode-${printMode}`}>
      <style>{`
        ${getPageCss(printMode)}

        .app-root {
          min-height: 100vh;
          background: #f6f6f7;
          color: #202223;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        }

        .screen-area {
          display: block;
          padding: 24px;
        }

        .page-container {
          max-width: 1360px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 18px;
        }

        .eyebrow {
          font-size: 12px;
          font-weight: 700;
          color: #6d7175;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 6px;
        }

        .page-title {
          margin: 0;
          font-size: 24px;
          line-height: 32px;
          font-weight: 750;
        }

        .page-description {
          margin: 6px 0 0;
          color: #6d7175;
          font-size: 14px;
          line-height: 20px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 16px;
        }

        .summary-card {
          background: #fff;
          border: 1px solid #e1e3e5;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
        }

        .summary-label {
          font-size: 13px;
          color: #6d7175;
          margin-bottom: 6px;
        }

        .summary-value {
          font-size: 26px;
          line-height: 32px;
          font-weight: 750;
        }

        .card {
          background: #fff;
          border: 1px solid #e1e3e5;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
        }

        .card-header {
          padding: 16px 18px;
          border-bottom: 1px solid #e1e3e5;
          background: #fff;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
        }

        .card-title {
          margin: 0;
          font-size: 16px;
          line-height: 24px;
          font-weight: 750;
        }

        .card-subtitle {
          margin: 4px 0 0;
          color: #6d7175;
          font-size: 13px;
          line-height: 18px;
        }

        .toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .button {
          min-height: 36px;
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid #202223;
          background: #202223;
          color: #fff;
          font-size: 14px;
          font-weight: 650;
          cursor: pointer;
          box-shadow: 0 1px 0 rgba(0, 0, 0, 0.08);
        }

        .button:hover {
          background: #111827;
        }

        .button-secondary {
          min-height: 36px;
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid #c9cccf;
          background: #fff;
          color: #202223;
          font-size: 14px;
          font-weight: 650;
          cursor: pointer;
        }

        .button-secondary:hover {
          background: #f6f6f7;
        }

        .select-box {
          min-height: 36px;
          border: 1px solid #babfc3;
          border-radius: 8px;
          background: #fff;
          color: #202223;
          font-size: 14px;
          line-height: 20px;
          padding: 8px 10px;
          box-sizing: border-box;
          outline: none;
        }

        .template-select {
          min-width: 250px;
        }

        .select-box:focus {
          border-color: #2c6ecb;
          box-shadow: 0 0 0 1px #2c6ecb;
        }

        .table-wrap {
          overflow-x: auto;
          width: 100%;
        }

        .data-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }

        .data-table th {
          background: #f6f6f7;
          border-bottom: 1px solid #e1e3e5;
          color: #6d7175;
          font-size: 12px;
          line-height: 16px;
          font-weight: 750;
          text-align: left;
          padding: 10px 12px;
          white-space: nowrap;
        }

        .data-table td {
          border-bottom: 1px solid #e1e3e5;
          color: #202223;
          font-size: 13px;
          line-height: 18px;
          padding: 12px;
          vertical-align: top;
        }

        .data-table tbody tr:hover {
          background: #fafafa;
        }

        .data-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .selected-row {
          background: #f2f7ff !important;
        }

        .checkbox-cell {
          width: 44px;
        }

        .order-checkbox {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .primary-text {
          font-weight: 650;
        }

        .muted-text {
          color: #6d7175;
          font-size: 12px;
          line-height: 17px;
          margin-top: 2px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          border-radius: 999px;
          background: #eaf4ff;
          color: #1f5199;
          border: 1px solid #b4d7ff;
          font-size: 12px;
          line-height: 16px;
          font-weight: 650;
          max-width: 100%;
          margin: 2px 4px 2px 0;
        }

        .badge-green {
          background: #f1f8f5;
          color: #008060;
          border-color: #aee9d1;
        }

        .badge-muted {
          background: #f6f6f7;
          color: #6d7175;
          border-color: #e1e3e5;
        }

        .address-cell {
          max-width: 360px;
        }

        .details-cell {
          max-width: 340px;
        }

        .empty-state {
          padding: 34px 18px;
          text-align: center;
          color: #6d7175;
          font-size: 14px;
          line-height: 20px;
        }

        .print-area {
          display: none;
        }

        @media (max-width: 1000px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .page-header {
            flex-direction: column;
          }
        }

        @media (max-width: 680px) {
          .screen-area {
            padding: 16px;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          .header-actions,
          .toolbar {
            width: 100%;
          }

          .select-box,
          .template-select,
          .button,
          .button-secondary {
            width: 100%;
          }
        }

        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            min-height: auto !important;
            height: auto !important;
            overflow: visible !important;
          }

          .app-root {
            padding: 0 !important;
            margin: 0 !important;
            min-height: auto !important;
            height: auto !important;
            background: #fff !important;
          }

          .screen-area {
            display: none !important;
          }

          .print-area {
            display: block !important;
            position: static !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #000 !important;
            font-family: Arial, Helvetica, sans-serif !important;
          }

          .label-page {
            width: 210mm !important;
            height: 297mm !important;
            padding: 10mm !important;
            box-sizing: border-box !important;
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            grid-auto-rows: 68mm !important;
            gap: 0 !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          .label-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .label-box {
            border: 1px solid #000;
            box-sizing: border-box;
            padding: 6mm 5mm;
            text-align: center;
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            overflow: hidden;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .label-logo {
            width: 100px;
            max-height: 45px;
            object-fit: contain;
            margin-bottom: 8px;
          }

          .label-name {
            font-size: 15px;
            font-weight: 700;
            margin-bottom: 4px;
          }

          .label-address {
            font-size: 10px;
            margin-bottom: 8px;
            line-height: 1.3;
          }

          .label-date {
            font-size: 15px;
            font-style: italic;
            font-weight: 700;
            margin-bottom: 4px;
          }

          .label-details {
            font-size: 12px;
            font-style: italic;
            line-height: 1.35;
          }

          .packing-page {
            width: 210mm !important;
            min-height: 297mm !important;
            padding: 12mm !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          .packing-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .packing-wrap {
            width: 100%;
          }

          .packing-header,
          .packing-main {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin-top: 0;
          }

          .packing-header td {
            border: 1px solid #ccc;
            padding: 10px;
            vertical-align: top;
          }

          .packing-left {
            width: 58%;
          }

          .packing-right {
            width: 42%;
            text-align: center;
          }

          .packing-name {
            font-size: 24px;
            font-weight: bold;
          }

          .packing-order {
            font-size: 16px;
            font-weight: normal;
          }

          .packing-type {
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 7px;
            letter-spacing: 0.5px;
          }

          .packing-meta {
            font-size: 13px;
            font-weight: bold;
            margin: 10px 0;
            line-height: 1.5;
          }

          .packing-driver-line {
            margin-top: 4px;
          }

          .packing-packer {
            font-size: 15px;
            margin-bottom: 6px;
          }

          .packing-instructions {
            font-size: 13px;
            margin-top: 4px;
          }

          .packing-logo {
            max-width: 220px;
            width: 100%;
          }

          .packing-main td {
            border: 1px solid #000;
            padding: 8px;
            vertical-align: top;
          }

          .packing-label {
            width: 28%;
            font-size: 18px;
            font-weight: bold;
          }

          .packing-value {
            width: 72%;
            font-size: 13px;
            line-height: 1.45;
          }

          .packing-value div {
            margin-bottom: 4px;
          }

          .packing-note {
            font-size: 12px;
            font-style: italic;
            margin-top: 8px;
          }

          .packing-footer {
            margin-top: 16px;
            font-size: 13px;
          }

          .packing-bottom {
            text-align: center;
            margin-top: 20px;
            font-size: 16px;
          }

          .packing-big {
            font-size: 20px;
            font-weight: bold;
          }

          .checklist-page {
            width: 297mm !important;
            min-height: 210mm !important;
            padding: 10mm !important;
            box-sizing: border-box !important;
            font-size: 11px !important;
          }

          .checklist-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
          }

          .checklist-title {
            font-size: 20px;
            font-weight: 700;
          }

          .checklist-support {
            font-size: 12px;
            font-weight: 600;
          }

          .checklist-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin-top: 0;
          }

          .checklist-table th,
          .checklist-table td {
            border: 1px solid #000;
            padding: 6px;
            vertical-align: top;
            word-wrap: break-word;
            font-size: 11px;
            white-space: pre-line;
          }

          .checklist-table th {
            background: #f3f3f3;
            font-weight: 700;
            text-align: left;
          }

          .checklist-name-col {
            width: 14%;
          }

          .checklist-driver-col {
            width: 12%;
          }

          .checklist-instructions-col {
            width: 18%;
          }

          .checklist-products-col {
            width: 14%;
          }

          .checklist-customer-name {
            font-weight: 700;
          }

          .checklist-order-name {
            margin-top: 3px;
          }

          .checklist-item-line {
            margin: 0 0 3px 0;
          }

          .checklist-footer {
            margin-top: 12px;
            text-align: center;
            font-size: 12px;
            font-weight: 600;
          }
        }
      `}</style>

      <div className="screen-area">
        <div className="page-container">
          <div className="page-header">
            <div>
              <div className="eyebrow">Print centre</div>
              <h1 className="page-title">Box Label Printer</h1>
              <p className="page-description">
                Select Shopify orders and print box labels, local packing slips, courier packing slips, or checklist.
              </p>
            </div>

            <div className="header-actions">
              <select
                className="select-box template-select"
                value={printMode}
                onChange={(event) => setPrintMode(event.target.value as PrintMode)}
              >
                <option value="labels">Box Labels</option>
                <option value="localPackingSlip">Packing Slip - Local Orders</option>
                <option value="courierPackingSlip">Packing Slip - Courier Orders</option>
                <option value="checklist">Checklist</option>
              </select>

              <button className="button" onClick={handlePrint}>
                {printButtonLabel}
              </button>
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <div className="summary-label">Orders loaded</div>
              <div className="summary-value">{orders.length}</div>
            </div>

            <div className="summary-card">
              <div className="summary-label">Visible orders</div>
              <div className="summary-value">{visibleOrders.length}</div>
            </div>

            <div className="summary-card">
              <div className="summary-label">Selected orders</div>
              <div className="summary-value">{selectedOrders.length}</div>
            </div>

            <div className="summary-card">
              <div className="summary-label">Orders with driver</div>
              <div className="summary-value">{ordersWithDriver}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Orders</h2>
                <p className="card-subtitle">
                  Showing {visibleOrders.length} orders. Selected {selectedOrders.length} orders.
                </p>
              </div>

              <div className="toolbar">
                <select
                  className="select-box"
                  value={ordersLimit}
                  onChange={(event) => {
                    setOrdersLimit(event.target.value);
                    setSelectedIds([]);
                  }}
                >
                  <option value="5">Show 5 orders</option>
                  <option value="10">Show 10 orders</option>
                  <option value="20">Show 20 orders</option>
                  <option value="50">Show 50 orders</option>
                </select>

                <button className="button-secondary" onClick={toggleAll}>
                  {selectedIds.length === visibleOrders.length ? "Unselect All" : "Select All"}
                </button>
              </div>
            </div>

            {visibleOrders.length === 0 ? (
              <div className="empty-state">No orders found.</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="checkbox-cell">Select</th>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Address</th>
                      <th>Delivery</th>
                      <th>Method</th>
                      <th>Additional Details</th>
                      <th>Driver</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleOrders.map((order) => (
                      <tr key={order.id} className={selectedIds.includes(order.id) ? "selected-row" : ""}>
                        <td className="checkbox-cell">
                          <input
                            className="order-checkbox"
                            type="checkbox"
                            checked={selectedIds.includes(order.id)}
                            onChange={() => toggleOrder(order.id)}
                          />
                        </td>

                        <td>
                          <div className="primary-text">{order.name}</div>
                        </td>

                        <td>{order.customerName || <span className="muted-text">No customer</span>}</td>

                        <td className="address-cell">
                          {formatShippingAddress(order) || <span className="muted-text">-</span>}
                        </td>

                        <td>
                          <div className="primary-text">{order.deliveryDate || "-"}</div>
                          {order.deliveryDay ? <div className="muted-text">{order.deliveryDay}</div> : null}
                        </td>

                        <td>
                          {order.deliveryMethod ? (
                            <span className="badge badge-green">{order.deliveryMethod}</span>
                          ) : (
                            <span className="badge badge-muted">No method</span>
                          )}
                        </td>

                        <td className="details-cell">
                          {order.customerTimeZone ? (
                            <div className="muted-text">Timezone: {order.customerTimeZone}</div>
                          ) : null}

                          {order.deliveryPostalCode ? (
                            <div className="muted-text">Delivery Postal Code: {order.deliveryPostalCode}</div>
                          ) : null}

                          {order.locationId ? <div className="muted-text">locationId: {order.locationId}</div> : null}

                          {order.shopifyLocationId ? (
                            <div className="muted-text">shopifyLocationId: {order.shopifyLocationId}</div>
                          ) : null}

                          {order.checkoutMethod ? (
                            <div className="muted-text">Checkout Method: {order.checkoutMethod}</div>
                          ) : null}

                          {order.pickupLocationCompany || order.deliveryLocation || order.pickupDetails ? (
                            <div className="muted-text">
                              Pickup / Location:{" "}
                              {order.pickupLocationCompany || order.deliveryLocation || order.pickupDetails}
                            </div>
                          ) : null}

                          {formatPickupAddress(order) ? (
                            <div className="muted-text">Pickup Address: {formatPickupAddress(order)}</div>
                          ) : null}

                          {order.packingInstructions ? (
                            <div className="muted-text">Packing Instructions: {order.packingInstructions}</div>
                          ) : null}

                          {!order.customerTimeZone &&
                          !order.deliveryPostalCode &&
                          !order.locationId &&
                          !order.shopifyLocationId &&
                          !order.checkoutMethod &&
                          !order.pickupLocationCompany &&
                          !order.deliveryLocation &&
                          !order.pickupDetails &&
                          !order.packingInstructions &&
                          !formatPickupAddress(order) ? (
                            <span className="muted-text">-</span>
                          ) : null}
                        </td>

                        <td>
                          {order.driverName ? (
                            <>
                              <span className="badge">{order.driverName}</span>
                              {order.driverPhone ? <div className="muted-text">Phone: {order.driverPhone}</div> : null}
                              {order.vehicleNumber || order.vehicleType ? (
                                <div className="muted-text">
                                  Vehicle: {[order.vehicleNumber, order.vehicleType].filter(Boolean).join(" - ")}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <span className="badge badge-muted">Not assigned</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="print-area">
        {printMode === "labels" ? <LabelsPrint orders={selectedOrders} /> : null}

        {printMode === "localPackingSlip" ? (
          <PackingSlipsPrint orders={selectedOrders} type="Local Orders" />
        ) : null}

        {printMode === "courierPackingSlip" ? (
          <PackingSlipsPrint orders={selectedOrders} type="Courier Orders" />
        ) : null}

        {printMode === "checklist" ? (
          <ChecklistPrint orders={selectedOrders} title="WEDNESDAY - LOCAL - Checklist" />
        ) : null}
      </div>
    </div>
  );
}

function LabelsPrint({ orders }: { orders: Order[] }) {
  return (
    <>
      {chunkArray(orders, 8).map((pageOrders, pageIndex) => (
        <div className="label-page" key={pageIndex}>
          {pageOrders.map((order) => (
            <div className="label-box" key={order.id}>
              <img className="label-logo" src={LOGO_URL} alt="Joy Wholefoods" />

              <div className="label-name">{order.customerName || "Customer Name"}</div>

              <div className="label-address">{formatShippingAddress(order)}</div>

              <div className="label-date">
                {order.deliveryDate || "Delivery Date"}
                {order.deliveryDay ? ` - ${order.deliveryDay}` : ""}
              </div>

              <div className="label-details">
                {order.deliveryMethod ? (
                  <>
                    Delivery Method: {order.deliveryMethod}
                    <br />
                  </>
                ) : null}

                {order.customerTimeZone ? (
                  <>
                    Customer TimeZone: {order.customerTimeZone}
                    <br />
                  </>
                ) : null}

                {order.deliveryPostalCode ? (
                  <>
                    Delivery Postal Code: {order.deliveryPostalCode}
                    <br />
                  </>
                ) : null}

                {order.locationId ? (
                  <>
                    locationId: {order.locationId}
                    <br />
                  </>
                ) : null}

                {order.shopifyLocationId ? (
                  <>
                    shopifyLocationId: {order.shopifyLocationId}
                    <br />
                  </>
                ) : null}

                {order.pickupLocationCompany ? (
                  <>
                    Pickup Location: {order.pickupLocationCompany}
                    <br />
                  </>
                ) : null}

                {formatPickupAddress(order) ? (
                  <>
                    Pickup Address: {formatPickupAddress(order)}
                    <br />
                  </>
                ) : null}

                {order.pickupDetails ? (
                  <>
                    Pickup Details: {order.pickupDetails}
                    <br />
                  </>
                ) : null}

                {formatDriverDetails(order) ? (
                  <>
                    {formatDriverDetails(order)}
                    <br />
                  </>
                ) : null}

                Order: {order.name}
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function PackingSlipsPrint({
  orders,
  type,
}: {
  orders: Order[];
  type: "Local Orders" | "Courier Orders";
}) {
  return (
    <>
      {orders.map((order) => {
        const groups = groupLineItems(order.lineItems);

        return (
          <div className="packing-page" key={order.id}>
            <div className="packing-wrap">
              <table className="packing-header">
                <tbody>
                  <tr>
                    <td className="packing-left">
                      <div className="packing-type">Packing Slip - {type}</div>

                      <div className="packing-name">
                        {order.customerName || "Customer Name"}{" "}
                        <span className="packing-order">{order.name}</span>
                      </div>

                      <div className="packing-meta">
                        <div>
                          Delivery {order.deliveryDay || order.deliveryDate || ""}
                          {order.pickupDetails ? ` ${order.pickupDetails}` : ""}
                        </div>

                        {formatDriverDetails(order) ? (
                          <div className="packing-driver-line">{formatDriverDetails(order)}</div>
                        ) : null}
                      </div>

                      <div className="packing-packer">
                        <b>Packer ID:</b> __________
                      </div>

                      {order.packingInstructions ? (
                        <div className="packing-instructions">
                          <b>Packing Instructions:</b> {order.packingInstructions}
                        </div>
                      ) : null}
                    </td>

                    <td className="packing-right">
                      <img className="packing-logo" src={LOGO_URL} alt="Joy Wholefoods Logo" />
                    </td>
                  </tr>
                </tbody>
              </table>

              <table className="packing-main">
                <tbody>
                  <tr>
                    <td className="packing-label">Fruit &amp; Veg</td>
                    <td className="packing-value">
                      <ItemLines items={groups.fruit} />
                    </td>
                  </tr>

                  <tr>
                    <td className="packing-label">Grocery &amp; Fridge</td>
                    <td className="packing-value">
                      <ItemLines items={[...groups.grocery, ...groups.fresh]} />
                    </td>
                  </tr>

                  <tr>
                    <td className="packing-label">
                      Frozen
                      <div className="packing-note">
                        Meat may defrost a little in transit — if it’s cold, it’s safe to refreeze
                      </div>
                    </td>
                    <td className="packing-value">
                      <ItemLines items={groups.frozen} />
                    </td>
                  </tr>

                  <tr>
                    <td className="packing-label">Fresh Baked</td>
                    <td className="packing-value">
                      <ItemLines items={groups.baked} />
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="packing-footer">
                Your box might look <u>overpacked</u> – that’s just to make sure it
                arrives happy. All packing is reused and recyclable. <b>Need help?</b>{" "}
                Text us on {SUPPORT_PHONE}.
              </div>

              <div className="packing-bottom">
                You just did something good for local farmers.
                <div className="packing-big">
                  Not bad for a {order.deliveryDay || "delivery day"}.
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function ChecklistPrint({ orders, title }: { orders: Order[]; title: string }) {
  return (
    <div className="checklist-page">
      <div className="checklist-header">
        <div className="checklist-title">{title}</div>
        <div className="checklist-support">Need help? Text us on {SUPPORT_PHONE}</div>
      </div>

      <table className="checklist-table">
        <thead>
          <tr>
            <th className="checklist-name-col">Name</th>
            <th className="checklist-driver-col">Driver/Pickup Details</th>
            <th className="checklist-instructions-col">Packing Instructions</th>
            <th className="checklist-products-col">Groceries</th>
            <th className="checklist-products-col">Frozen</th>
            <th className="checklist-products-col">Fresh</th>
            <th className="checklist-products-col">Baked</th>
          </tr>
        </thead>

        <tbody>
          {orders.map((order) => {
            const groups = groupLineItems(order.lineItems);
            const freshItems = [...groups.fruit, ...groups.fresh];

            return (
              <tr key={order.id}>
                <td>
                  <div className="checklist-customer-name">{order.customerName || "Customer Name"}</div>
                  <div className="checklist-order-name">{order.name}</div>
                </td>
                <td>{formatDriverPickupDetails(order)}</td>
                <td>{order.packingInstructions}</td>
                <td>
                  <ChecklistItemLines items={groups.grocery} />
                </td>
                <td>
                  <ChecklistItemLines items={groups.frozen} />
                </td>
                <td>
                  <ChecklistItemLines items={freshItems} />
                </td>
                <td>
                  <ChecklistItemLines items={groups.baked} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="checklist-footer">Need help? Text us on {SUPPORT_PHONE}</div>
    </div>
  );
}

function ItemLines({ items }: { items: LineItem[] }) {
  if (items.length === 0) return null;

  return (
    <>
      {items.map((item) => (
        <div key={item.id}>{formatLineItem(item)}</div>
      ))}
    </>
  );
}

function ChecklistItemLines({ items }: { items: LineItem[] }) {
  if (items.length === 0) return null;

  return (
    <>
      {items.map((item) => (
        <div className="checklist-item-line" key={item.id}>
          {formatLineItem(item)}
        </div>
      ))}
    </>
  );
}

function formatLineItem(item: LineItem) {
  const quantity = item.currentQuantity || item.unfulfilledQuantity || item.quantity || 0;
  const title = item.productTitle || item.title;

  return `[${quantity}] ${title}`;
}

function groupLineItems(lineItems: LineItem[]) {
  return lineItems.reduce(
    (groups, item) => {
      const category = getLineItemCategory(item);
      groups[category].push(item);
      return groups;
    },
    {
      fruit: [] as LineItem[],
      grocery: [] as LineItem[],
      frozen: [] as LineItem[],
      fresh: [] as LineItem[],
      baked: [] as LineItem[],
    },
  );
}

function getLineItemCategory(item: LineItem): "fruit" | "grocery" | "frozen" | "fresh" | "baked" {
  const searchable = [
    item.title,
    item.productTitle,
    item.variantTitle,
    item.productType,
    ...item.tags,
  ]
    .join(" ")
    .toLowerCase();

  if (
    searchable.includes("fruit") ||
    searchable.includes("veg") ||
    searchable.includes("vegetable") ||
    searchable.includes("banana") ||
    searchable.includes("apple") ||
    searchable.includes("berry") ||
    searchable.includes("berries")
  ) {
    return "fruit";
  }

  if (
    searchable.includes("bread") ||
    searchable.includes("cake") ||
    searchable.includes("buns") ||
    searchable.includes("pastry") ||
    searchable.includes("baked") ||
    searchable.includes("bakery")
  ) {
    return "baked";
  }

  if (
    searchable.includes("chicken") ||
    searchable.includes("beef") ||
    searchable.includes("pork") ||
    searchable.includes("fish") ||
    searchable.includes("meat") ||
    searchable.includes("frozen")
  ) {
    return "frozen";
  }

  if (
    searchable.includes("milk") ||
    searchable.includes("cheese") ||
    searchable.includes("yoghurt") ||
    searchable.includes("yogurt") ||
    searchable.includes("cream") ||
    searchable.includes("fridge") ||
    searchable.includes("refrigerated")
  ) {
    return "fresh";
  }

  return "grocery";
}

function formatShippingAddress(order: Order) {
  return [order.address, order.city, order.province, order.zip, order.country]
    .filter(Boolean)
    .join(", ");
}

function formatPickupAddress(order: Order) {
  return [
    order.pickupLocationAddressLine1,
    order.pickupLocationCity,
    order.pickupLocationRegion,
    order.pickupLocationPostalCode,
    order.pickupLocationCountry,
  ]
    .filter(Boolean)
    .join(", ");
}

function formatDriverDetails(order: Order) {
  const vehicle = [order.vehicleNumber, order.vehicleType].filter(Boolean).join(" - ");

  return [
    order.driverName ? `Driver: ${order.driverName}` : "",
    order.driverPhone ? `Phone: ${order.driverPhone}` : "",
    vehicle ? `Vehicle: ${vehicle}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

function formatDriverPickupDetails(order: Order) {
  return [
    formatDriverDetails(order),
    order.pickupDetails,
    order.pickupLocationCompany,
    formatPickupAddress(order),
  ]
    .filter(Boolean)
    .join("\n");
}

function parseDriverDetails(value: string | null | undefined): DriverDetails {
  if (!value) {
    return {
      name: "",
      phone: "",
      vehicleNumber: "",
      vehicleType: "",
    };
  }

  try {
    const parsed = JSON.parse(value);

    return {
      name: parsed?.name || "",
      phone: parsed?.phone || "",
      vehicleNumber: parsed?.vehicleNumber || "",
      vehicleType: parsed?.vehicleType || "",
    };
  } catch {
    return {
      name: "",
      phone: "",
      vehicleNumber: "",
      vehicleType: "",
    };
  }
}

function getOrderValue(
  order: {
    customAttributes?: CustomAttribute[];
    note?: string;
  },
  noteKey: string,
  customKeys: string[],
) {
  return (
    getCustomValue(order.customAttributes || [], customKeys) ||
    getNoteValue(order.note || "", noteKey) ||
    ""
  );
}

function getCustomValue(customAttributes: CustomAttribute[] = [], keys: string[]) {
  const normalizedKeys = keys.map((key) => normalizeKey(key));

  const found = customAttributes.find((attr) =>
    normalizedKeys.includes(normalizeKey(attr.key)),
  );

  return found?.value || "";
}

function getNoteValue(note: string, key: string) {
  if (!note) return "";

  const lines = note
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const matchedLine = lines.find((line) =>
    normalizeKey(line).startsWith(`${normalizeKey(key)}:`),
  );

  if (!matchedLine) return "";

  return matchedLine.split(":").slice(1).join(":").trim();
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];

  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }

  return result;
}

function getPrintButtonLabel(printMode: PrintMode) {
  if (printMode === "localPackingSlip") return "Print Local Packing Slips";
  if (printMode === "courierPackingSlip") return "Print Courier Packing Slips";
  if (printMode === "checklist") return "Print Checklist";
  return "Print Labels";
}

function getPageCss(printMode: PrintMode) {
  if (printMode === "checklist") {
    return `
      @page {
        size: A4 landscape;
        margin: 0;
      }
    `;
  }

  return `
    @page {
      size: A4 portrait;
      margin: 0;
    }
  `;
}