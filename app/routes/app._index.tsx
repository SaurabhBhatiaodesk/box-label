import { useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

const LOGO_URL =
  "https://cdn.shopify.com/s/files/1/0483/3758/4295/files/Joy_Wholefoods_-_Primary_Logo_-_Dark.png?v=1775531358";

type CustomAttribute = {
  key: string;
  value: string;
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
  deliveryLocation: string;
  locationId: string;
  customAttribute2: string;
  pickupLocationCompany: string;
  deliveryDate: string;
  deliveryDay: string;
  pickupDetails: string;
  driverName: string;
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
          }
        }
      }
    }
  `);

  const data = await response.json();

  const orders: Order[] =
    data?.data?.orders?.edges?.map((edge: any) => {
      const order = edge.node;
      const shipping = order.shippingAddress;

      return {
        id: order.id,
        name: order.name,
        createdAt: order.createdAt,
        note: order.note || "",

        customerName:
          shipping?.name ||
          `${order.customer?.firstName || ""} ${
            order.customer?.lastName || ""
          }`.trim(),

        address: [shipping?.address1, shipping?.address2]
          .filter(Boolean)
          .join(", "),

        city: shipping?.city || "",
        province: shipping?.province || "",
        country: shipping?.country || "",
        zip: shipping?.zip || "",
        phone: shipping?.phone || order.customer?.phone || "",

        deliveryMethod: getOrderValue(order, "Delivery Method", [
          "Delivery Method",
          "delivery_method",
          "deliveryMethod",
          "delivery-method",
        ]),

        customerTimeZone: getOrderValue(order, "Customer TimeZone", [
          "Customer TimeZone",
          "Customer Timezone",
          "customer_timezone",
          "customerTimeZone",
        ]),

        deliveryLocation: getOrderValue(order, "Delivery Location", [
          "Delivery Location",
          "delivery_location",
          "deliveryLocation",
          "delivery-location",
        ]),

        locationId: getOrderValue(order, "locationId", [
          "locationId",
          "Location ID",
          "location_id",
          "location-id",
        ]),

        customAttribute2: getOrderValue(order, "Custom-Attribute-2", [
          "Custom-Attribute-2",
          "Custom Attribute 2",
          "custom_attribute_2",
          "customAttribute2",
        ]),

        pickupLocationCompany: getOrderValue(order, "Pickup-Location-Company", [
          "Pickup-Location-Company",
          "Pickup Location Company",
          "pickup_location_company",
          "pickupLocationCompany",
        ]),

        deliveryDate: getOrderValue(order, "Delivery Date", [
          "Delivery Date",
          "delivery_date",
          "deliveryDate",
          "delivery-date",
        ]),

        deliveryDay: getOrderValue(order, "Delivery Day", [
          "Delivery Day",
          "delivery_day",
          "deliveryDay",
          "delivery-day",
        ]),

        pickupDetails: getOrderValue(order, "Pickup Details", [
          "Pickup Details",
          "pickup_details",
          "pickupDetails",
          "pickup-details",
        ]),

        driverName: getOrderValue(order, "Driver", [
          "Driver",
          "driver",
          "Driver Name",
          "driver_name",
          "driverName",
        ]),
      };
    }) || [];

  return { orders };
};

export default function Index() {
  const { orders } = useLoaderData() as { orders: Order[] };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ordersLimit, setOrdersLimit] = useState("20");

  const visibleOrders = useMemo(() => {
    return orders.slice(0, Number(ordersLimit));
  }, [orders, ordersLimit]);

  const selectedOrders = useMemo(() => {
    return visibleOrders.filter((order) => selectedIds.includes(order.id));
  }, [visibleOrders, selectedIds]);

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

  return (
    <div className="app-root">
      <style>{`
        .app-root {
          padding: 24px;
        }

        .screen-area {
          display: block;
        }

        .app-card {
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
          margin-top: 20px;
        }

        .top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .button {
          background: #111827;
          color: white;
          border: 0;
          border-radius: 6px;
          padding: 10px 16px;
          cursor: pointer;
          font-weight: 600;
        }

        .button-secondary {
          background: #f3f4f6;
          color: #111827;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 10px 16px;
          cursor: pointer;
          font-weight: 600;
        }

        .select-box {
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 10px;
          min-width: 180px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 16px;
        }

        th,
        td {
          border-bottom: 1px solid #e5e7eb;
          padding: 12px;
          text-align: left;
          font-size: 14px;
          vertical-align: top;
        }

        th {
          background: #f9fafb;
          font-weight: 700;
        }

        .small-text {
          font-size: 12px;
          color: #4b5563;
          line-height: 1.4;
        }

        .print-area {
          display: none;
        }

        @page {
          size: A4 portrait;
          margin: 0;
        }

        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            width: 210mm !important;
            min-height: auto !important;
            height: auto !important;
            overflow: visible !important;
          }

          .app-root {
            padding: 0 !important;
            margin: 0 !important;
            width: 210mm !important;
            min-height: auto !important;
            height: auto !important;
          }

          .screen-area {
            display: none !important;
          }

          .print-area {
            display: block !important;
            position: static !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
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
        }
      `}</style>

      <div className="screen-area">
        <div className="top-row">
          <div>
            <h1>Box Label Printer</h1>
            <p>Select Shopify orders and print box labels.</p>
          </div>

          <button className="button" onClick={handlePrint}>
            Print Labels
          </button>
        </div>

        <div className="app-card">
          <div className="top-row">
            <div>
              <h2>Orders</h2>
              <p>
                Showing {visibleOrders.length} orders. Selected{" "}
                {selectedOrders.length} orders.
              </p>
            </div>

            <div className="top-row">
              <select
                className="select-box"
                value={ordersLimit}
                onChange={(e) => {
                  setOrdersLimit(e.target.value);
                  setSelectedIds([]);
                }}
              >
                <option value="5">Show 5 orders</option>
                <option value="10">Show 10 orders</option>
                <option value="20">Show 20 orders</option>
                <option value="50">Show 50 orders</option>
              </select>

              <button className="button-secondary" onClick={toggleAll}>
                {selectedIds.length === visibleOrders.length
                  ? "Unselect All"
                  : "Select All"}
              </button>
            </div>
          </div>

          {visibleOrders.length === 0 ? (
            <p>No orders found.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Address</th>
                  <th>Delivery Date</th>
                  <th>Delivery Method</th>
                  <th>Pickup / Location</th>
                  <th>Driver</th>
                </tr>
              </thead>

              <tbody>
                {visibleOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.id)}
                        onChange={() => toggleOrder(order.id)}
                      />
                    </td>

                    <td>{order.name}</td>

                    <td>{order.customerName || "No customer"}</td>

                    <td>
                      {order.address || "-"}
                      {order.city ? `, ${order.city}` : ""}
                      {order.province ? `, ${order.province}` : ""}
                      {order.zip ? `, ${order.zip}` : ""}
                    </td>

                    <td>
                      {order.deliveryDate || "-"}
                      {order.deliveryDay ? (
                        <div className="small-text">{order.deliveryDay}</div>
                      ) : null}
                    </td>

                    <td>{order.deliveryMethod || "-"}</td>

                    <td>
                      {order.pickupLocationCompany ||
                        order.pickupDetails ||
                        order.deliveryLocation ||
                        "-"}

                      {order.deliveryLocation ? (
                        <div className="small-text">
                          {order.deliveryLocation}
                        </div>
                      ) : null}
                    </td>

                    <td>{order.driverName || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="print-area">
        {chunkArray(selectedOrders, 8).map((pageOrders, pageIndex) => (
          <div className="label-page" key={pageIndex}>
            {pageOrders.map((order) => (
              <div className="label-box" key={order.id}>
                <img
                  className="label-logo"
                  src={LOGO_URL}
                  alt="Joy Wholefoods"
                />

                <div className="label-name">
                  {order.customerName || "Customer Name"}
                </div>

                <div className="label-address">
                  {order.address}
                  {order.city ? `, ${order.city}` : ""}
                  {order.province ? `, ${order.province}` : ""}
                  {order.zip ? `, ${order.zip}` : ""}
                </div>

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

                  {order.pickupLocationCompany ? (
                    <>
                      Pickup Location: {order.pickupLocationCompany}
                      <br />
                    </>
                  ) : null}

                  {order.deliveryLocation ? (
                    <>
                      Delivery Location: {order.deliveryLocation}
                      <br />
                    </>
                  ) : null}

                  {order.pickupDetails ? (
                    <>
                      Pickup Details: {order.pickupDetails}
                      <br />
                    </>
                  ) : null}

                  {order.driverName ? (
                    <>
                      Driver: {order.driverName}
                      <br />
                    </>
                  ) : null}

                  Order: {order.name}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
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

function getCustomValue(
  customAttributes: CustomAttribute[] = [],
  keys: string[],
) {
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
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];

  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }

  
  return result;
}   