import { useMemo, useState } from "react";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

type Driver = {
  id: string;
  name: string;
  phone: string | null;
  vehicleNumber: string | null;
  vehicleType: string | null;
  notes: string | null;
};

type Order = {
  id: string;
  name: string;
  createdAt: string;
  customerName: string;
  address: string;
  deliveryDate: string;
  deliveryDay: string;
  deliveryMethod: string;
  assignedDriverName: string;
  assignedVehicleNumber: string;
};

type ActionData = {
  ok?: boolean;
  message?: string;
  error?: string;
};

export const loader = async ({ request }: { request: Request }) => {
  const { admin, session } = await authenticate.admin(request);

  const [drivers, response] = await Promise.all([
    prisma.driver.findMany({
      where: {
        shop: session.shop,
        isActive: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    admin.graphql(`
      query GetDriverAssignmentOrders {
        orders(first: 50, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              name
              createdAt
              customer {
                firstName
                lastName
              }
              shippingAddress {
                name
                address1
                address2
                city
                province
                zip
                country
              }
              customAttributes {
                key
                value
              }
              driverDetailsMetafield: metafield(namespace: "custom", key: "driver_details") {
                value
              }
            }
          }
        }
      }
    `),
  ]);

  const data = await response.json();

  if (data?.errors) {
    console.error("Shopify GraphQL errors:", JSON.stringify(data.errors, null, 2));
  }

  const orders: Order[] =
    data?.data?.orders?.edges?.map((edge: any) => {
      const order = edge.node;
      const shipping = order.shippingAddress;
      const driverDetails = parseDriverDetails(order.driverDetailsMetafield?.value);

      return {
        id: order.id,
        name: order.name,
        createdAt: order.createdAt,
        customerName:
          shipping?.name ||
          `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim(),
        address: [
          shipping?.address1,
          shipping?.address2,
          shipping?.city,
          shipping?.province,
          shipping?.zip,
          shipping?.country,
        ]
          .filter(Boolean)
          .join(", "),
        deliveryDate: getCustomValue(order.customAttributes || [], [
          "Delivery Date",
          "delivery_date",
          "deliveryDate",
          "delivery-date",
        ]),
        deliveryDay: getCustomValue(order.customAttributes || [], [
          "Delivery Day",
          "delivery_day",
          "deliveryDay",
          "delivery-day",
        ]),
        deliveryMethod: getCustomValue(order.customAttributes || [], [
          "Delivery Method",
          "delivery_method",
          "deliveryMethod",
          "delivery-method",
        ]),
        assignedDriverName: driverDetails.name,
        assignedVehicleNumber: driverDetails.vehicleNumber,
      };
    }) || [];

  return { drivers, orders };
};

export const action = async ({ request }: { request: Request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "createDriver") {
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const vehicleNumber = String(formData.get("vehicleNumber") || "").trim();
    const vehicleType = String(formData.get("vehicleType") || "").trim();
    const notes = String(formData.get("notes") || "").trim();

    if (!name) {
      return { ok: false, error: "Driver name is required." };
    }

    await prisma.driver.create({
      data: {
        shop: session.shop,
        name,
        phone,
        vehicleNumber,
        vehicleType,
        notes,
      },
    });

    return { ok: true, message: "Driver added successfully." };
  }

  if (intent === "assignOrders") {
    const driverId = String(formData.get("driverId") || "");
    const orderIds = formData
      .getAll("orderIds")
      .map((id) => String(id))
      .filter(Boolean);

    if (!driverId) {
      return { ok: false, error: "Please select a driver." };
    }

    if (orderIds.length === 0) {
      return { ok: false, error: "Please select at least one order." };
    }

    const driver = await prisma.driver.findFirst({
      where: {
        id: driverId,
        shop: session.shop,
        isActive: true,
      },
    });

    if (!driver) {
      return { ok: false, error: "Driver not found." };
    }

    const driverDetails = {
      id: driver.id,
      name: driver.name,
      phone: driver.phone || "",
      vehicleNumber: driver.vehicleNumber || "",
      vehicleType: driver.vehicleType || "",
      assignedAt: new Date().toISOString(),
    };

    const metafields = orderIds.map((orderId) => ({
      ownerId: orderId,
      namespace: "custom",
      key: "driver_details",
      type: "json",
      value: JSON.stringify(driverDetails),
    }));

    const response = await admin.graphql(
      `#graphql
        mutation AssignDriverToOrders($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              key
              namespace
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        variables: {
          metafields,
        },
      },
    );

    const data = await response.json();
    const userErrors = data?.data?.metafieldsSet?.userErrors || [];

    if (data?.errors || userErrors.length > 0) {
      console.error("Driver assignment error:", JSON.stringify(data, null, 2));

      return {
        ok: false,
        error: userErrors[0]?.message || "Driver assignment failed.",
      };
    }

    return {
      ok: true,
      message: `Driver assigned to ${orderIds.length} order(s).`,
    };
  }

  return { ok: false, error: "Invalid action." };
};

export default function DriversPage() {
  const { drivers, orders } = useLoaderData() as {
    drivers: Driver[];
    orders: Order[];
  };

  const actionData = useActionData() as ActionData | undefined;
  const navigation = useNavigation();

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [ordersLimit, setOrdersLimit] = useState("20");

  const visibleOrders = useMemo(() => {
    return orders.slice(0, Number(ordersLimit));
  }, [orders, ordersLimit]);

  const isSubmitting = navigation.state !== "idle";

  const toggleOrder = (orderId: string) => {
    setSelectedOrderIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId],
    );
  };

  const toggleAll = () => {
    if (selectedOrderIds.length === visibleOrders.length) {
      setSelectedOrderIds([]);
      return;
    }

    setSelectedOrderIds(visibleOrders.map((order) => order.id));
  };

  return (
    <div className="driver-page">
      <style>{`
        .driver-page {
          padding: 24px;
          background: #f6f6f7;
          min-height: 100vh;
        }

        .driver-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }

        .driver-card {
          background: #fff;
          border: 1px solid #d9d9d9;
          border-radius: 10px;
          padding: 18px;
          margin-bottom: 18px;
        }

        .driver-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .field label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .field input,
        .field textarea,
        .field select {
          width: 100%;
          border: 1px solid #c9cccf;
          border-radius: 6px;
          padding: 10px;
          box-sizing: border-box;
        }

        .full-width {
          grid-column: 1 / -1;
        }

        .button-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        .button {
          background: #111827;
          color: #fff;
          border: 0;
          border-radius: 6px;
          padding: 10px 16px;
          cursor: pointer;
          font-weight: 700;
        }

        .button-secondary {
          background: #f3f4f6;
          color: #111827;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 10px 16px;
          cursor: pointer;
          font-weight: 700;
        }

        .message {
          padding: 10px 12px;
          border-radius: 6px;
          margin-bottom: 16px;
          font-weight: 600;
        }

        .message-success {
          background: #ecfdf3;
          color: #027a48;
          border: 1px solid #abefc6;
        }

        .message-error {
          background: #fef3f2;
          color: #b42318;
          border: 1px solid #fecdca;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 14px;
        }

        th,
        td {
          border-bottom: 1px solid #e5e7eb;
          padding: 11px;
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
          margin-top: 4px;
          line-height: 1.35;
        }

        @media (max-width: 900px) {
          .driver-grid,
          .form-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="driver-header">
        <div>
          <h1>Driver & Vehicle</h1>
          <p>Add drivers/vehicles and assign selected orders to the correct driver.</p>
        </div>
      </div>

      {actionData?.message ? (
        <div className="message message-success">{actionData.message}</div>
      ) : null}

      {actionData?.error ? (
        <div className="message message-error">{actionData.error}</div>
      ) : null}

      <div className="driver-grid">
        <div className="driver-card">
          <h2>Add Driver / Vehicle</h2>

          <Form method="post">
            <input type="hidden" name="intent" value="createDriver" />

            <div className="form-grid">
              <div className="field">
                <label htmlFor="name">Driver Name *</label>
                <input id="name" name="name" required />
              </div>

              <div className="field">
                <label htmlFor="phone">Phone</label>
                <input id="phone" name="phone" />
              </div>

              <div className="field">
                <label htmlFor="vehicleNumber">Vehicle Number</label>
                <input id="vehicleNumber" name="vehicleNumber" />
              </div>

              <div className="field">
                <label htmlFor="vehicleType">Vehicle Type</label>
                <input id="vehicleType" name="vehicleType" placeholder="Van, Truck, Car" />
              </div>

              <div className="field full-width">
                <label htmlFor="notes">Notes</label>
                <textarea id="notes" name="notes" rows={3} />
              </div>
            </div>

            <div className="button-row">
              <button className="button" type="submit" disabled={isSubmitting}>
                Add Driver
              </button>
            </div>
          </Form>
        </div>

        <div className="driver-card">
          <h2>Saved Drivers</h2>

          {drivers.length === 0 ? (
            <p>No drivers added yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Vehicle</th>
                  <th>Notes</th>
                </tr>
              </thead>

              <tbody>
                {drivers.map((driver) => (
                  <tr key={driver.id}>
                    <td>
                      <b>{driver.name}</b>
                      {driver.phone ? <div className="small-text">{driver.phone}</div> : null}
                    </td>

                    <td>
                      {[driver.vehicleNumber, driver.vehicleType].filter(Boolean).join(" - ") ||
                        "-"}
                    </td>

                    <td>{driver.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="driver-card">
        <div className="driver-header">
          <div>
            <h2>Assign Orders</h2>
            <p>
              Showing {visibleOrders.length} orders. Selected {selectedOrderIds.length} orders.
            </p>
          </div>

          <div className="button-row">
            <select
              value={ordersLimit}
              onChange={(event) => {
                setOrdersLimit(event.target.value);
                setSelectedOrderIds([]);
              }}
            >
              <option value="5">Show 5 orders</option>
              <option value="10">Show 10 orders</option>
              <option value="20">Show 20 orders</option>
              <option value="50">Show 50 orders</option>
            </select>

            <button className="button-secondary" type="button" onClick={toggleAll}>
              {selectedOrderIds.length === visibleOrders.length ? "Unselect All" : "Select All"}
            </button>
          </div>
        </div>

        <Form method="post">
          <input type="hidden" name="intent" value="assignOrders" />

          <div className="form-grid">
            <div className="field">
              <label htmlFor="driverId">Select Driver</label>
              <select id="driverId" name="driverId" required>
                <option value="">Choose driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                    {driver.vehicleNumber ? ` - ${driver.vehicleNumber}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedOrderIds.map((orderId) => (
            <input key={orderId} type="hidden" name="orderIds" value={orderId} />
          ))}

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
                  <th>Delivery</th>
                  <th>Current Driver</th>
                </tr>
              </thead>

              <tbody>
                {visibleOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.includes(order.id)}
                        onChange={() => toggleOrder(order.id)}
                      />
                    </td>

                    <td>{order.name}</td>

                    <td>{order.customerName || "No customer"}</td>

                    <td>{order.address || "-"}</td>

                    <td>
                      {order.deliveryDate || "-"}
                      {order.deliveryDay ? (
                        <div className="small-text">{order.deliveryDay}</div>
                      ) : null}
                      {order.deliveryMethod ? (
                        <div className="small-text">{order.deliveryMethod}</div>
                      ) : null}
                    </td>

                    <td>
                      {order.assignedDriverName || "-"}
                      {order.assignedVehicleNumber ? (
                        <div className="small-text">{order.assignedVehicleNumber}</div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="button-row">
            <button className="button" type="submit" disabled={isSubmitting || drivers.length === 0}>
              Assign Selected Orders
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}

function parseDriverDetails(value: string | null | undefined) {
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
  } catch (error) {
    return {
      name: "",
      phone: "",
      vehicleNumber: "",
      vehicleType: "",
    };
  }
}

function getCustomValue(customAttributes: { key: string; value: string }[] = [], keys: string[]) {
  const normalizedKeys = keys.map((key) => normalizeKey(key));
  const found = customAttributes.find((attr) => normalizedKeys.includes(normalizeKey(attr.key)));

  return found?.value || "";
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}