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

  if (data?.errors) {
    console.error("Shopify GraphQL errors:", JSON.stringify(data.errors, null, 2));
  }

  const orders: Order[] =
    data?.data?.orders?.edges?.map((edge: any) => {
      const order = edge.node;
      const shipping = order.shippingAddress;

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

      const driverName = getOrderValue(order, "Driver", [
        "Driver",
        "driver",
        "Driver Name",
        "driver_name",
        "driverName",
      ]);

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
        driverName,
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
          margin-top: 3px;
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
                  <th>Additional Details</th>
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

                    <td>{formatShippingAddress(order) || "-"}</td>

                    <td>
                      {order.deliveryDate || "-"}
                      {order.deliveryDay ? (
                        <div className="small-text">{order.deliveryDay}</div>
                      ) : null}
                    </td>

                    <td>{order.deliveryMethod || "-"}</td>

                    <td>
                      {order.customerTimeZone ? (
                        <div className="small-text">
                          Timezone: {order.customerTimeZone}
                        </div>
                      ) : null}

                      {order.deliveryPostalCode ? (
                        <div className="small-text">
                          Delivery Postal Code: {order.deliveryPostalCode}
                        </div>
                      ) : null}

                      {order.locationId ? (
                        <div className="small-text">
                          locationId: {order.locationId}
                        </div>
                      ) : null}

                      {order.shopifyLocationId ? (
                        <div className="small-text">
                          shopifyLocationId: {order.shopifyLocationId}
                        </div>
                      ) : null}

                      {order.checkoutMethod ? (
                        <div className="small-text">
                          Checkout Method: {order.checkoutMethod}
                        </div>
                      ) : null}

                      {order.pickupLocationCompany ||
                      order.deliveryLocation ||
                      order.pickupDetails ? (
                        <div className="small-text">
                          Pickup / Location:{" "}
                          {order.pickupLocationCompany ||
                            order.deliveryLocation ||
                            order.pickupDetails}
                        </div>
                      ) : null}

                      {formatPickupAddress(order) ? (
                        <div className="small-text">
                          Pickup Address: {formatPickupAddress(order)}
                        </div>
                      ) : null}

                      {!order.customerTimeZone &&
                      !order.deliveryPostalCode &&
                      !order.locationId &&
                      !order.shopifyLocationId &&
                      !order.checkoutMethod &&
                      !order.pickupLocationCompany &&
                      !order.deliveryLocation &&
                      !order.pickupDetails &&
                      !formatPickupAddress(order)
                        ? "-"
                        : null}
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
                  {formatShippingAddress(order)}
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

function formatShippingAddress(order: Order) {
  return [
    order.address,
    order.city,
    order.province,
    order.zip,
    order.country,
  ]
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