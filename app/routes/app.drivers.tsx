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

  const assignedOrdersCount = useMemo(() => {
    return orders.filter((order) => order.assignedDriverName).length;
  }, [orders]);

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
    <div className="page-shell">
      <style>{`
        .page-shell {
          min-height: 100vh;
          padding: 24px;
          background: #f6f6f7;
          color: #202223;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
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
          color: #202223;
        }

        .page-description {
          margin: 6px 0 0;
          color: #6d7175;
          font-size: 14px;
          line-height: 20px;
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
          color: #202223;
        }

        .grid-two {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 16px;
          margin-bottom: 16px;
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

        .card-body {
          padding: 18px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .field.full {
          grid-column: 1 / -1;
        }

        .field label {
          display: block;
          font-size: 13px;
          line-height: 18px;
          font-weight: 650;
          margin-bottom: 6px;
        }

        .field input,
        .field textarea,
        .field select,
        .toolbar-select {
          width: 100%;
          border: 1px solid #babfc3;
          border-radius: 8px;
          background: #fff;
          color: #202223;
          font-size: 14px;
          line-height: 20px;
          padding: 9px 11px;
          box-sizing: border-box;
          outline: none;
        }

        .field input:focus,
        .field textarea:focus,
        .field select:focus,
        .toolbar-select:focus {
          border-color: #2c6ecb;
          box-shadow: 0 0 0 1px #2c6ecb;
        }

        .field textarea {
          resize: vertical;
          min-height: 74px;
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 16px;
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

        .button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
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

        .message {
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 16px;
          font-size: 14px;
          line-height: 20px;
          font-weight: 650;
        }

        .message-success {
          background: #f1f8f5;
          border: 1px solid #aee9d1;
          color: #008060;
        }

        .message-error {
          background: #fff4f4;
          border: 1px solid #fed3d1;
          color: #d72c0d;
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
        }

        .badge-muted {
          background: #f6f6f7;
          color: #6d7175;
          border-color: #e1e3e5;
        }

        .empty-state {
          padding: 28px 18px;
          text-align: center;
          color: #6d7175;
          font-size: 14px;
          line-height: 20px;
        }

        .assign-row {
          display: grid;
          grid-template-columns: minmax(240px, 440px) auto;
          gap: 12px;
          align-items: end;
          margin-bottom: 16px;
        }

        .toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .toolbar-select {
          width: auto;
          min-width: 145px;
          padding: 8px 10px;
          font-size: 13px;
        }

        .checkbox-cell {
          width: 44px;
        }

        .order-checkbox {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .address-cell {
          max-width: 420px;
        }

        @media (max-width: 1000px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .grid-two {
            grid-template-columns: 1fr;
          }

          .assign-row {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 680px) {
          .page-shell {
            padding: 16px;
          }

          .summary-grid,
          .form-grid {
            grid-template-columns: 1fr;
          }

          .page-header {
            flex-direction: column;
          }
        }
      `}</style>

      <div className="page-container">
        <div className="page-header">
          <div>
            <div className="eyebrow">Delivery setup</div>
            <h1 className="page-title">Driver & Vehicle</h1>
            <p className="page-description">
              Add drivers, save vehicle details, and assign selected delivery orders before printing.
            </p>
          </div>
        </div>

        {actionData?.message ? (
          <div className="message message-success">{actionData.message}</div>
        ) : null}

        {actionData?.error ? (
          <div className="message message-error">{actionData.error}</div>
        ) : null}

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">Saved drivers</div>
            <div className="summary-value">{drivers.length}</div>
          </div>

          <div className="summary-card">
            <div className="summary-label">Orders loaded</div>
            <div className="summary-value">{orders.length}</div>
          </div>

          <div className="summary-card">
            <div className="summary-label">Assigned orders</div>
            <div className="summary-value">{assignedOrdersCount}</div>
          </div>

          <div className="summary-card">
            <div className="summary-label">Selected orders</div>
            <div className="summary-value">{selectedOrderIds.length}</div>
          </div>
        </div>

        <div className="grid-two">
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Add Driver / Vehicle</h2>
                <p className="card-subtitle">Create a driver profile for order assignment.</p>
              </div>
            </div>

            <div className="card-body">
              <Form method="post">
                <input type="hidden" name="intent" value="createDriver" />

                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="name">Driver Name *</label>
                    <input id="name" name="name" required placeholder="e.g. John Smith" />
                  </div>

                  <div className="field">
                    <label htmlFor="phone">Phone</label>
                    <input id="phone" name="phone" placeholder="e.g. 0480 000 000" />
                  </div>

                  <div className="field">
                    <label htmlFor="vehicleNumber">Vehicle Number</label>
                    <input id="vehicleNumber" name="vehicleNumber" placeholder="e.g. ABC 123" />
                  </div>

                  <div className="field">
                    <label htmlFor="vehicleType">Vehicle Type</label>
                    <input id="vehicleType" name="vehicleType" placeholder="Van, Truck, Car" />
                  </div>

                  <div className="field full">
                    <label htmlFor="notes">Notes</label>
                    <textarea id="notes" name="notes" rows={3} placeholder="Optional notes" />
                  </div>
                </div>

                <div className="actions">
                  <button className="button" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Add Driver"}
                  </button>
                </div>
              </Form>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Saved Drivers</h2>
                <p className="card-subtitle">Available drivers and vehicle details.</p>
              </div>
            </div>

            {drivers.length === 0 ? (
              <div className="empty-state">No drivers added yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
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
                          <div className="primary-text">{driver.name}</div>
                          {driver.phone ? <div className="muted-text">{driver.phone}</div> : null}
                        </td>

                        <td>
                          {driver.vehicleNumber ? (
                            <span className="badge">{driver.vehicleNumber}</span>
                          ) : (
                            <span className="badge badge-muted">No vehicle</span>
                          )}
                          {driver.vehicleType ? <div className="muted-text">{driver.vehicleType}</div> : null}
                        </td>

                        <td>{driver.notes || <span className="muted-text">-</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Assign Orders</h2>
              <p className="card-subtitle">
                Showing {visibleOrders.length} orders. Selected {selectedOrderIds.length} orders.
              </p>
            </div>

            <div className="toolbar">
              <select
                className="toolbar-select"
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

          <div className="card-body">
            <Form method="post">
              <input type="hidden" name="intent" value="assignOrders" />

              <div className="assign-row">
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

                <button className="button" type="submit" disabled={isSubmitting || drivers.length === 0}>
                  {isSubmitting ? "Assigning..." : "Assign Selected Orders"}
                </button>
              </div>

              {selectedOrderIds.map((orderId) => (
                <input key={orderId} type="hidden" name="orderIds" value={orderId} />
              ))}

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
                        <th>Current Driver</th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleOrders.map((order) => (
                        <tr
                          key={order.id}
                          className={selectedOrderIds.includes(order.id) ? "selected-row" : ""}
                        >
                          <td className="checkbox-cell">
                            <input
                              className="order-checkbox"
                              type="checkbox"
                              checked={selectedOrderIds.includes(order.id)}
                              onChange={() => toggleOrder(order.id)}
                            />
                          </td>

                          <td>
                            <div className="primary-text">{order.name}</div>
                          </td>

                          <td>{order.customerName || <span className="muted-text">No customer</span>}</td>

                          <td className="address-cell">{order.address || <span className="muted-text">-</span>}</td>

                          <td>
                            <div className="primary-text">{order.deliveryDate || "-"}</div>
                            {order.deliveryDay ? <div className="muted-text">{order.deliveryDay}</div> : null}
                            {order.deliveryMethod ? <div className="muted-text">{order.deliveryMethod}</div> : null}
                          </td>

                          <td>
                            {order.assignedDriverName ? (
                              <>
                                <span className="badge">{order.assignedDriverName}</span>
                                {order.assignedVehicleNumber ? (
                                  <div className="muted-text">{order.assignedVehicleNumber}</div>
                                ) : null}
                              </>
                            ) : (
                              <span className="muted-text">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Form>
          </div>
        </div>
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
  } catch {
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