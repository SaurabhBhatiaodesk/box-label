import { useEffect, useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

const LOGO_URL =
  "https://cdn.shopify.com/s/files/1/0483/3758/4295/files/Untitled_3508_x_700_px.jpg?v=1779782616";

const SUPPORT_PHONE = "0480 079 218";
const PACKING_SLIP_WORD_FONT_SIZE = 21;
const ORDERS_FETCH_LIMIT = 1500;
const ORDERS_PAGE_SIZE = 100;
const ORDER_DETAILS_BATCH_SIZE = 20;

type PrintMode =
  | "labels"
  | "courierLabels"
  | "localPackingSlip"
  | "courierPackingSlip"
  | "checklist";

type CustomAttribute = {
  key: string;
  value: string;
};

type LineItem = {
  id: string;
  title: string;
  productName: string;
  quantity: number;
  currentQuantity: number;
  unfulfilledQuantity: number;
  variantTitle: string;
  sku: string;
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
  easyRoutesRoute: string;
  easyRoutesStopNumber: string;
  easyRoutesRouteStart: string;
  easyRoutesStopEta: string;
  driverName: string;
  boxPreference: string;
  deliveryInstructions: string;
  packingInstructions: string;
  lineItems: LineItem[];
};

export const loader = async ({ request }: { request: Request }) => {
  await authenticate.admin(request);

  const requestUrl = new URL(request.url);

  // app._index.tsx is the index route for /app. React Router requires the
  // ?index query parameter so POST requests reach this file's action instead
  // of the parent app.tsx route. Loader data requests can also use /app.data,
  // so remove the .data suffix before creating the action URL.
  const actionPathname = requestUrl.pathname.replace(/\.data$/, "");
  const actionUrl = `${requestUrl.origin}${actionPathname}?index`;

  // Render the embedded app immediately. Orders are loaded progressively
  // from the browser in small authenticated batches, preventing a blank
  // Shopify iframe while 1,500 orders are being requested.
  return { orders: [] as Order[], actionUrl };
};

async function fetchOrderSummaries(
  admin: any,
  maxOrders: number,
  startingCursor: string | null = null,
) {

  const allEdges: any[] = [];
  let hasNextPage = true;
  let cursor: string | null = startingCursor;

  while (hasNextPage && allEdges.length < maxOrders) {
    const first = Math.min(
      ORDERS_PAGE_SIZE,
      maxOrders - allEdges.length,
    );

    const response = await admin.graphql(
      `#graphql
        query GetOrders($first: Int!, $after: String) {
          orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true, query: "status:any") {
            edges {
              cursor
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

            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `,
      {
        variables: {
          first,
          after: cursor,
        },
      },
    );

    const data = await response.json();

    if (data?.errors) {
      console.error(
        "Shopify GraphQL errors:",
        JSON.stringify(data.errors, null, 2),
      );
      break;
    }

    const edges = data?.data?.orders?.edges || [];
    allEdges.push(...edges);

    hasNextPage = Boolean(data?.data?.orders?.pageInfo?.hasNextPage);
    cursor = data?.data?.orders?.pageInfo?.endCursor || null;

    if (!cursor) {
      break;
    }
  }

  const orders: Order[] =
    allEdges.map((edge: any) => {
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
        "Delivery Zone",
        "delivery_zone",
        "deliveryZone",
        "delivery-zone",
        "Zone",
        "zone",
      ]);

      const pickupLocationId = getOrderValue(order, "Pickup-Location-Id", [
        "Pickup-Location-Id",
        "Pickup Location Id",
        "Pickup Location ID",
        "pickup_location_id",
        "pickupLocationId",
      ]);

      const pickupLocationCompany = getOrderValue(
        order,
        "Pickup-Location-Company",
        [
          "Pickup-Location-Company",
          "Pickup Location Company",
          "pickup_location_company",
          "pickupLocationCompany",
        ],
      );

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

      const pickupLocationRegion = getOrderValue(
        order,
        "Pickup-Location-Region",
        [
          "Pickup-Location-Region",
          "Pickup Location Region",
          "pickup_location_region",
          "pickupLocationRegion",
        ],
      );

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

      const pickupLocationCountry = getOrderValue(
        order,
        "Pickup-Location-Country",
        [
          "Pickup-Location-Country",
          "Pickup Location Country",
          "pickup_location_country",
          "pickupLocationCountry",
        ],
      );

      const pickupDetails = getOrderValue(order, "Pickup Details", [
        "Pickup Details",
        "pickup_details",
        "pickupDetails",
        "pickup-details",
      ]);

      const easyRoutesRoute = getOrderValue(order, "EasyRoutes Route", [
        "EasyRoutes Route",
        "easyroutes_route",
        "easyRoutesRoute",
        "easyroutesRoute",
        "easy-routes-route",
        "EasyRoutes Route Name",
        "easyroutes_route_name",
        "easyRoutesRouteName",
        "easy-routes-route-name",
        "Route",
        "route",
        "Route Name",
        "route_name",
        "routeName",
      ]);

      const easyRoutesStopNumber = getOrderValue(
        order,
        "EasyRoutes Stop Number",
        [
          "EasyRoutes Stop Number",
          "easyroutes_stop_number",
          "easyRoutesStopNumber",
          "easy-routes-stop-number",
        ],
      );

      const easyRoutesRouteStart = getOrderValue(
        order,
        "EasyRoutes Route Start",
        [
          "EasyRoutes Route Start",
          "easyroutes_route_start",
          "easyRoutesRouteStart",
          "easy-routes-route-start",
        ],
      );

      const easyRoutesStopEta = getOrderValue(order, "EasyRoutes Stop ETA", [
        "EasyRoutes Stop ETA",
        "EasyRoutes Stop Eta",
        "easyroutes_stop_eta",
        "easyRoutesStopETA",
        "easy-routes-stop-eta",
      ]);

      const easyRoutesDriverName = getOrderValue(order, "EasyRoutes Driver", [
        "EasyRoutes Driver",
        "easyroutes driver",
        "EasyRoutes Driver Name",
        "easyroutes_driver",
        "easyroutesDriver",
        "easy-routes-driver",
        "Route Driver",
        "route_driver",
        "routeDriver",
        "Delivery Driver",
        "delivery_driver",
        "deliveryDriver",
        "Driver",
        "driver",
        "Driver Name",
        "driver_name",
        "driverName",
      ]);

      const driverName =
        parseDriverFromEasyRoutesRoute(easyRoutesRoute) || easyRoutesDriverName;

      const boxPreference = getOrderValue(order, "Box Preference", [
        "Box Preference",
        "box_preference",
        "boxPreference",
        "box-preference",
      ]);

      const deliveryInstructions = getCurrentOrderDeliveryInstructions(order);
      const packingInstructions = getCurrentOrderPackingInstructions(order);

      const lineItems: LineItem[] =
        order.lineItems?.edges?.map((lineEdge: any) => {
          const item = lineEdge.node;

          return {
            id: item.id,
            title: item.title || item.product?.title || "",
            productName: cleanLineItemName(
              item.name || item.title || item.product?.title || "",
            ),
            quantity: Number(item.quantity || 0),
            currentQuantity: Number(item.currentQuantity || 0),
            unfulfilledQuantity: Number(item.unfulfilledQuantity || 0),
            variantTitle: item.variantTitle || "",
            sku: item.variant?.sku || "",
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
        easyRoutesRoute,
        easyRoutesStopNumber,
        easyRoutesRouteStart,
        easyRoutesStopEta,
        driverName,
        boxPreference,
        deliveryInstructions,
        packingInstructions,
        lineItems,
      };
    }) || [];

  return { orders, hasNextPage, cursor };
}

export const action = async ({ request }: { request: Request }) => {
  const { admin } = await authenticate.admin(request);

  let payload: {
    mode?: unknown;
    orderIds?: unknown;
    after?: unknown;
    remaining?: unknown;
  } = {};

  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  if (payload.mode === "list") {
    const after =
      typeof payload.after === "string" && payload.after.trim()
        ? payload.after
        : null;

    const requestedRemaining = Number(payload.remaining);
    const remaining = Number.isFinite(requestedRemaining)
      ? Math.max(1, Math.min(ORDERS_FETCH_LIMIT, requestedRemaining))
      : ORDERS_PAGE_SIZE;

    const pageLimit = Math.min(ORDERS_PAGE_SIZE, remaining);
    const result = await fetchOrderSummaries(admin, pageLimit, after);

    return Response.json({
      orders: result.orders,
      pageInfo: {
        hasNextPage: result.hasNextPage,
        endCursor: result.cursor,
      },
    });
  }

  const orderIds = Array.isArray(payload.orderIds)
    ? payload.orderIds.filter(
        (orderId): orderId is string =>
          typeof orderId === "string" && orderId.trim().length > 0,
      )
    : [];

  if (orderIds.length === 0) {
    return Response.json({ orders: [] });
  }

  const uniqueOrderIds = Array.from(new Set(orderIds)).slice(
    0,
    ORDERS_FETCH_LIMIT,
  );

  const detailedOrders: Array<
    Pick<
      Order,
      | "id"
      | "note"
      | "boxPreference"
      | "pickupLocationCompany"
      | "deliveryInstructions"
      | "packingInstructions"
      | "lineItems"
    >
  > = [];

  for (const orderIdBatch of chunkArray(
    uniqueOrderIds,
    ORDER_DETAILS_BATCH_SIZE,
  )) {
    const response = await admin.graphql(
      `#graphql
        query GetSelectedOrderDetails($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Order {
              id
              note

              customAttributes {
                key
                value
              }

              orderDeliveryInstructionsMetafield: metafield(namespace: "custom", key: "delivery_instructions") {
                value
              }

              orderPackingInstructionsMetafield: metafield(namespace: "custom", key: "packing_instructions") {
                value
              }

              lineItems(first: 100) {
                edges {
                  node {
                    id
                    name
                    title
                    quantity
                    currentQuantity
                    unfulfilledQuantity
                    variantTitle
                    variant {
                      sku
                    }
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
      `,
      {
        variables: {
          ids: orderIdBatch,
        },
      },
    );

    const data = await response.json();

    if (data?.errors) {
      console.error(
        "Shopify selected-order GraphQL errors:",
        JSON.stringify(data.errors, null, 2),
      );

      return Response.json(
        { error: "Unable to load the selected order details." },
        { status: 502 },
      );
    }

    const nodes = (data?.data?.nodes || []).filter(Boolean);

    for (const order of nodes) {
      const lineItems: LineItem[] =
        order.lineItems?.edges?.map((lineEdge: any) => {
          const item = lineEdge.node;

          return {
            id: item.id,
            title: item.title || item.product?.title || "",
            productName: cleanLineItemName(
              item.name || item.title || item.product?.title || "",
            ),
            quantity: Number(item.quantity || 0),
            currentQuantity: Number(item.currentQuantity || 0),
            unfulfilledQuantity: Number(item.unfulfilledQuantity || 0),
            variantTitle: item.variantTitle || "",
            sku: item.variant?.sku || "",
            productType: item.product?.productType || "",
            tags: item.product?.tags || [],
          };
        }) || [];

      detailedOrders.push({
        id: order.id,
        note: order.note || "",
        boxPreference: getOrderValue(order, "Box Preference", [
          "Box Preference",
          "box_preference",
          "boxPreference",
          "box-preference",
        ]),
        pickupLocationCompany: getOrderValue(
          order,
          "Pickup-Location-Company",
          [
            "Pickup-Location-Company",
            "Pickup Location Company",
            "pickup_location_company",
            "pickupLocationCompany",
          ],
        ),
        deliveryInstructions: getCurrentOrderDeliveryInstructions(order),
        packingInstructions: getCurrentOrderPackingInstructions(order),
        lineItems,
      });
    }
  }

  return Response.json({ orders: detailedOrders });
};

export default function Index() {
  const { orders: initialOrders, actionUrl } = useLoaderData() as {
    orders: Order[];
    actionUrl: string;
  };

  const [orders, setOrders] = useState<Order[]>(initialOrders || []);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [ordersLoadError, setOrdersLoadError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ordersLimit, setOrdersLimit] = useState("20");
  const [printMode, setPrintMode] = useState<PrintMode>("labels");
  const [deliveryDateSearch, setDeliveryDateSearch] = useState("");
  const [routeCourierFilter, setRouteCourierFilter] = useState<
    "all" | "local" | "courier"
  >("all");
  const [printOrders, setPrintOrders] = useState<Order[]>([]);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);


  useEffect(() => {
    let cancelled = false;

    const loadOrdersProgressively = async () => {
      setIsLoadingOrders(true);
      setOrdersLoadError("");

      const loadedOrders: Order[] = [];
      let after: string | null = null;
      let hasNextPage = true;

      try {
        while (
          !cancelled &&
          hasNextPage &&
          loadedOrders.length < ORDERS_FETCH_LIMIT
        ) {
          const previousCursor = after;
          const remaining = ORDERS_FETCH_LIMIT - loadedOrders.length;

          const response = await postAuthenticatedJson(actionUrl, {
            mode: "list",
            after,
            remaining,
          });

          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              data?.error || `Unable to load orders (${response.status}).`,
            );
          }

          const pageOrders = Array.isArray(data?.orders) ? data.orders : [];
          loadedOrders.push(...pageOrders);

          if (!cancelled) {
            setOrders([...loadedOrders]);
          }

          hasNextPage = Boolean(data?.pageInfo?.hasNextPage);
          after = data?.pageInfo?.endCursor || null;

          if (
            pageOrders.length === 0 ||
            !after ||
            after === previousCursor
          ) {
            break;
          }
        }
      } catch (error) {
        console.error("Progressive order loading failed:", error);

        if (!cancelled) {
          setOrdersLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load orders. Please refresh and try again.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingOrders(false);
        }
      }
    };

    loadOrdersProgressively();

    return () => {
      cancelled = true;
    };
  }, [actionUrl]);

  const filteredOrders = useMemo(() => {
    const search = normalizeSearchText(deliveryDateSearch);

    return orders.filter((order) => {
      const routeText = normalizeSearchText(order.easyRoutesRoute);
      const isCourierRoute = routeText.includes("courier");

      if (routeCourierFilter === "local" && isCourierRoute) {
        return false;
      }

      if (routeCourierFilter === "courier" && !isCourierRoute) {
        return false;
      }

      if (!search) {
        return true;
      }

      const searchableText = normalizeSearchText(
        [
          order.name,
          order.customerName,
          order.deliveryDate,
          order.deliveryDay,
          order.deliveryMethod,
          order.easyRoutesRoute,
          order.driverName,
          formatShippingAddress(order),
        ].join(" "),
      );

      return searchableText.includes(search);
    });
  }, [orders, deliveryDateSearch, routeCourierFilter]);

  const visibleOrders = useMemo(() => {
    return filteredOrders.slice(0, Number(ordersLimit));
  }, [filteredOrders, ordersLimit]);

  const selectedOrders = useMemo(() => {
    return sortOrdersForPackingAndLabels(
      visibleOrders.filter((order) => selectedIds.includes(order.id)),
    );
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

  const loadLatestSelectedOrderDetails = async () => {
    const requiresDetailedOrders =
      printMode === "localPackingSlip" ||
      printMode === "courierPackingSlip" ||
      printMode === "checklist";

    if (!requiresDetailedOrders) {
      return selectedOrders;
    }

    const response = await postAuthenticatedJson(actionUrl, {
      mode: "details",
      orderIds: selectedOrders.map((order) => order.id),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data?.error || `Unable to load order details (${response.status}).`,
      );
    }

    const detailsByOrderId = new Map<string, Partial<Order>>(
      (data?.orders || []).map((order: Partial<Order> & { id: string }) => [
        order.id,
        order,
      ]),
    );

    return selectedOrders.map((order) => ({
      ...order,
      ...(detailsByOrderId.get(order.id) || {}),
      lineItems:
        detailsByOrderId.get(order.id)?.lineItems || order.lineItems || [],
    }));
  };

  const handlePrint = async () => {
    if (selectedOrders.length === 0) {
      alert("Please select at least one order.");
      return;
    }

    setIsPreparingPrint(true);

    try {
      const latestOrders = await loadLatestSelectedOrderDetails();
      setPrintOrders(latestOrders);

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      window.print();
    } catch (error) {
      console.error("Print preparation failed:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Unable to prepare the selected orders for printing.",
      );
    } finally {
      setIsPreparingPrint(false);
    }
  };

  const handleExportWord = async () => {
    if (selectedOrders.length === 0) {
      alert("Please select at least one order.");
      return;
    }

    if (
      printMode !== "localPackingSlip" &&
      printMode !== "courierPackingSlip" &&
      printMode !== "checklist"
    ) {
      alert("Word export is available for Packing Slips and Checklist only.");
      return;
    }

    setIsPreparingPrint(true);

    try {
      const latestOrders = await loadLatestSelectedOrderDetails();
      await exportSelectedOrdersToWord(latestOrders, printMode);
    } catch (error) {
      console.error("Word export failed:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Word export failed. Please try again.",
      );
    } finally {
      setIsPreparingPrint(false);
    }
  };

  const printButtonLabel = getPrintButtonLabel(printMode);
  const showWordExportButton =
    printMode === "localPackingSlip" ||
    printMode === "courierPackingSlip" ||
    printMode === "checklist";

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

        .load-notice {
          margin-bottom: 16px;
          padding: 12px 14px;
          border: 1px solid #b4d7ff;
          border-radius: 10px;
          background: #eaf4ff;
          color: #1f5199;
          font-size: 14px;
          line-height: 20px;
          font-weight: 650;
        }

        .load-notice-error {
          border-color: #fed3d1;
          background: #fff4f4;
          color: #8e1f0b;
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

        .search-row {
          padding: 16px 18px;
          border-bottom: 1px solid #e1e3e5;
          background: #fbfbfb;
          display: grid;
          grid-template-columns: minmax(240px, 1fr) minmax(220px, 280px) auto;
          gap: 12px;
          align-items: end;
        }

        .field label {
          display: block;
          font-size: 13px;
          line-height: 18px;
          font-weight: 650;
          margin-bottom: 6px;
        }

        .search-input,
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

        .search-input {
          width: 100%;
        }

        .template-select {
          min-width: 250px;
        }

        .search-input:focus,
        .select-box:focus {
          border-color: #2c6ecb;
          box-shadow: 0 0 0 1px #2c6ecb;
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

        .button:disabled,
        .button-secondary:disabled {
          cursor: wait;
          opacity: 0.65;
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
          max-width: 360px;
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

          .page-header,
          .search-row {
            grid-template-columns: 1fr;
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
            border: 0 !important;
            outline: none !important;
            box-shadow: none !important;
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
            width: 235px;
            max-height: 82px;
            object-fit: contain;
            margin-bottom: 7px;
          }

          .label-name {
            font-size: calc(20px + 2pt);
            line-height: 1.1;
            font-weight: 800;
            margin-bottom: 4px;
          }

          .label-address {
            font-size: calc(11px + 2pt);
            margin-bottom: 7px;
            line-height: 1.25;
          }

          .label-date {
            font-size: calc(15px + 2pt);
            font-style: italic;
            font-weight: 700;
            margin-bottom: 4px;
          }

          .label-details {
            font-size: calc(13px + 2pt);
            font-style: italic;
            line-height: 1.25;
          }

          .label-driver {
            font-size: calc(16px + 2pt);
            font-weight: 800;
          }

          .packing-page {
            width: auto !important;
            min-height: auto !important;
            padding: 10mm 12mm 14mm !important;
            box-sizing: border-box !important;
            font-size: 10.5pt !important;
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
            padding: 8px;
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
            font-size: 10.5pt;
            font-weight: bold;
          }

          .packing-order {
            font-size: 10.5pt;
            font-weight: normal;
          }

          .packing-meta {
            font-size: 10.5pt;
            font-weight: bold;
            margin: 8px 0;
            line-height: 1.35;
          }

          .packing-driver-line {
            margin-top: 4px;
          }

          .packing-packer {
            font-size: 10.5pt;
            margin-bottom: 6px;
          }

          .packing-instructions {
            font-size: 10.5pt;
            margin-top: 4px;
          }

          .packing-logo {
            max-width: 240px;
            width: 100%;
          }

          .packing-main tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .packing-main td {
            border: 1px solid #000;
            padding: 7px;
            vertical-align: top;
          }

          .packing-label {
            width: 28%;
            font-size: 10.5pt;
            font-weight: bold;
          }

          .packing-value {
            width: 72%;
            font-size: 10.5pt;
            line-height: 1.35;
          }

          .packing-value div {
            margin-bottom: 3px;
          }

          .packing-note {
            font-size: 10.5pt;
            font-style: italic;
            margin-top: 7px;
            line-height: 1.25;
          }

          .packing-footer {
            margin-top: 18px;
            text-align: center;
            font-size: 10.5pt;
            line-height: 1.25;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .packing-footer p {
            margin: 0 0 12px 0;
          }

          .packing-footer-good {
            margin-top: 8px;
          }

          .packing-footer-good strong {
            display: block;
          }

          .packing-bottom {
            text-align: center;
            margin-top: 20px;
            font-size: 10.5pt;
          }

          .packing-big {
            font-size: 10.5pt;
            font-weight: bold;
          }

          .checklist-page {
            width: auto !important;
            min-height: auto !important;
            padding: 10mm !important;
            box-sizing: border-box !important;
            font-size: 11px !important;
            page-break-after: auto !important;
            break-after: auto !important;
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

          .checklist-date {
            margin-top: 3px;
            font-size: 13px;
            font-weight: 700;
          }

          .checklist-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin-top: 0;
          }

          .checklist-table thead {
            display: table-header-group;
          }

          .checklist-table tbody tr {
            page-break-inside: avoid;
            break-inside: avoid;
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
            width: 14%;
          }

          .checklist-instructions-col {
            width: 20%;
          }

          .checklist-products-col {
            width: 17%;
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

          .checklist-group {
            margin-bottom: 6px;
          }

          .checklist-group-title {
            font-weight: 700;
            margin-bottom: 3px;
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
                Search orders by delivery date or EasyRoutes date, then print
                labels, packing slips, or checklist.
              </p>
            </div>

            <div className="header-actions">
              <select
                className="select-box template-select"
                value={printMode}
                onChange={(event) =>
                  setPrintMode(event.target.value as PrintMode)
                }
              >
                <option value="labels">Box Labels - Local Orders</option>
                <option value="courierLabels">
                  Box Labels - Courier Orders
                </option>
                <option value="localPackingSlip">
                  Packing Slip - Local Orders
                </option>
                <option value="courierPackingSlip">
                  Packing Slip - Courier Orders
                </option>
                <option value="checklist">Checklist</option>
              </select>

              {showWordExportButton ? (
                <button
                  className="button-secondary"
                  type="button"
                  onClick={handleExportWord}
                  disabled={isPreparingPrint}
                >
                  {isPreparingPrint ? "Preparing..." : "Export to Word"}
                </button>
              ) : null}

              <button
                className="button"
                onClick={handlePrint}
                disabled={isPreparingPrint}
              >
                {isPreparingPrint ? "Preparing..." : printButtonLabel}
              </button>
            </div>
          </div>

          {isLoadingOrders ? (
            <div className="load-notice">
              Loading orders… {orders.length} of up to {ORDERS_FETCH_LIMIT}
            </div>
          ) : ordersLoadError ? (
            <div className="load-notice load-notice-error">
              {ordersLoadError}
            </div>
          ) : null}

          <div className="summary-grid">
            <div className="summary-card">
              <div className="summary-label">Orders loaded</div>
              <div className="summary-value">{orders.length}</div>
            </div>

            <div className="summary-card">
              <div className="summary-label">Filtered orders</div>
              <div className="summary-value">{filteredOrders.length}</div>
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
                  Showing {visibleOrders.length} of {filteredOrders.length}{" "}
                  matching orders.
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
                  <option value="20">Show 20 orders</option>
                  <option value="50">Show 50 orders</option>
                  <option value="100">Show 100 orders</option>
                  <option value="250">Show 250 orders</option>
                  <option value="1500">Show all loaded</option>
                </select>

                <button className="button-secondary" onClick={toggleAll}>
                  {selectedIds.length === visibleOrders.length
                    ? "Unselect All"
                    : "Select All"}
                </button>
              </div>
            </div>

            <div className="search-row">
              <div className="field">
                <label htmlFor="deliveryDateSearch">
                  Search by delivery date / EasyRoutes date / driver
                </label>
                <input
                  id="deliveryDateSearch"
                  className="search-input"
                  type="text"
                  value={deliveryDateSearch}
                  onChange={(event) => {
                    setDeliveryDateSearch(event.target.value);
                    setSelectedIds([]);
                  }}
                  placeholder="Example: 21/05/2026 / May 21, 2026 / Trevor"
                />
              </div>

              <div className="field">
                <label htmlFor="routeCourierFilter">
                  EasyRoutes Route filter
                </label>
                <select
                  id="routeCourierFilter"
                  className="select-box"
                  value={routeCourierFilter}
                  onChange={(event) => {
                    setRouteCourierFilter(
                      event.target.value as "all" | "local" | "courier",
                    );
                    setSelectedIds([]);
                  }}
                >
                  <option value="all">All routes</option>
                  <option value="local">
                    Local orders - route does not contain Courier
                  </option>
                  <option value="courier">
                    Courier orders - route contains Courier
                  </option>
                </select>
              </div>

              <button
                className="button-secondary"
                type="button"
                onClick={() => {
                  setDeliveryDateSearch("");
                  setRouteCourierFilter("all");
                  setSelectedIds([]);
                }}
              >
                Clear Search
              </button>
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
                      <th>EasyRoutes Route</th>
                      <th>Driver</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleOrders.map((order) => (
                      <tr
                        key={order.id}
                        className={
                          selectedIds.includes(order.id) ? "selected-row" : ""
                        }
                      >
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

                        <td>
                          {order.customerName || (
                            <span className="muted-text">No customer</span>
                          )}
                        </td>

                        <td className="address-cell">
                          {formatShippingAddress(order) || (
                            <span className="muted-text">-</span>
                          )}
                        </td>

                        <td>
                          <div className="primary-text">
                            {order.deliveryDate || "-"}
                          </div>
                          {order.deliveryDay ? (
                            <div className="muted-text">
                              {order.deliveryDay}
                            </div>
                          ) : null}
                        </td>

                        <td>
                          {order.deliveryMethod ? (
                            <span className="badge badge-green">
                              {order.deliveryMethod}
                            </span>
                          ) : (
                            <span className="badge badge-muted">No method</span>
                          )}
                        </td>

                        <td className="details-cell">
                          {order.easyRoutesRoute ? (
                            <>
                              <div className="primary-text">
                                {order.easyRoutesRoute}
                              </div>
                              {order.easyRoutesStopNumber ? (
                                <div className="muted-text">
                                  Stop Number: {order.easyRoutesStopNumber}
                                </div>
                              ) : null}
                              {order.easyRoutesRouteStart ? (
                                <div className="muted-text">
                                  Route Start: {order.easyRoutesRouteStart}
                                </div>
                              ) : null}
                              {order.easyRoutesStopEta ? (
                                <div className="muted-text">
                                  Stop ETA: {order.easyRoutesStopEta}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <span className="muted-text">-</span>
                          )}
                        </td>

                        <td>
                          {order.driverName ? (
                            <span className="badge">{order.driverName}</span>
                          ) : (
                            <span className="badge badge-muted">Not found</span>
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
        {printMode === "labels" ? (
          <LabelsPrint orders={printOrders} template="local" />
        ) : null}

        {printMode === "courierLabels" ? (
          <LabelsPrint orders={printOrders} template="courier" />
        ) : null}

        {printMode === "localPackingSlip" ? (
          <PackingSlipsPrint orders={printOrders} type="Local Orders" />
        ) : null}

        {printMode === "courierPackingSlip" ? (
          <PackingSlipsPrint orders={printOrders} type="Courier Orders" />
        ) : null}

        {printMode === "checklist" ? (
          <ChecklistPrint orders={printOrders} />
        ) : null}
      </div>
    </div>
  );
}

function LabelsPrint({
  orders,
  template,
}: {
  orders: Order[];
  template: "local" | "courier";
}) {
  return (
    <>
      {chunkArray(orders, 8).map((pageOrders, pageIndex) => (
        <div className="label-page" key={pageIndex}>
          {pageOrders.map((order) => {
            const labelRouteText =
              template === "courier" || isCourierOrder(order)
                ? "Courier"
                : order.driverName;

            return (
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
                  {formatBoxLabelAddress(order)}
                </div>

                <div className="label-date">
                  {order.deliveryDate || "Delivery Date"}
                </div>

                <div className="label-details">
                  {labelRouteText ? (
                    <div className="label-driver">{labelRouteText}</div>
                  ) : null}
                  {order.pickupDetails ? (
                    <div>{order.pickupDetails}</div>
                  ) : null}
                  {order.pickupLocationCompany ? (
                    <div>{order.pickupLocationCompany}</div>
                  ) : null}
                </div>
              </div>
            );
          })}
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
        const groups = getPackingSlipLineItemGroups(order.lineItems);
        const packingInstructionsText = order.boxPreference || "";
        const packingInstructionsLabel = "Box Preference";
        const packingRouteDriverDateText =
          formatPackingSlipRouteDriverDate(order);

        return (
          <div className="packing-page" key={order.id}>
            <div className="packing-wrap">
              <table className="packing-header">
                <tbody>
                  <tr>
                    <td className="packing-left">
                      <div className="packing-name">
                        {order.customerName || "Customer Name"}{" "}
                        <span className="packing-order">{order.name}</span>
                      </div>

                      <div className="packing-meta">
                        {packingRouteDriverDateText ? (
                          <div className="packing-driver-line">
                            {packingRouteDriverDateText}
                          </div>
                        ) : null}
                      </div>

                      <div className="packing-packer">
                        <b>Packer ID:</b> __________
                      </div>

                      {packingInstructionsText ? (
                        <div className="packing-instructions">
                          <i>
                            <b>{packingInstructionsLabel}:</b>{" "}
                            {packingInstructionsText}
                          </i>
                        </div>
                      ) : null}
                    </td>

                    <td className="packing-right">
                      <img
                        className="packing-logo"
                        src={LOGO_URL}
                        alt="Joy Wholefoods Logo"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              <table className="packing-main">
                <tbody>
                  <tr>
                    <td className="packing-label">Produce</td>
                    <td className="packing-value">
                      <ItemLines
                        items={[
                          ...groups.produceOnly,
                          ...groups.produceAndGroceries,
                        ]}
                      />
                    </td>
                  </tr>

                  <tr>
                    <td className="packing-label">Groceries</td>
                    <td className="packing-value">
                      <ItemLines items={groups.groceriesOnly} />
                    </td>
                  </tr>

                  <tr>
                    <td className="packing-label">
                      Frozen
                      <div className="packing-note">
                        Meat may defrost a little in transit — if it’s cold,
                        it’s safe to refreeze
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

              <PackingSlipFooter type={type} />
            </div>
          </div>
        );
      })}
    </>
  );
}

function PackingSlipFooter({
  type,
}: {
  type: "Local Orders" | "Courier Orders";
}) {
  const footerContent = getPackingSlipFooterContent(type);

  return (
    <div className="packing-footer">
      <p>{footerContent.body}</p>

      <p>
        <strong>Need help?</strong> Text us on {SUPPORT_PHONE}.
      </p>

      <div className="packing-footer-good">
        <strong>{footerContent.closing}</strong>
      </div>
    </div>
  );
}

function ChecklistPrint({ orders }: { orders: Order[] }) {
  const checklistOrders = getChecklistVisibleOrders(orders);
  const deliveryDateLabel = getChecklistDeliveryDateLabel(checklistOrders);

  return (
    <div className="checklist-page">
      <div className="checklist-header">
        <div>
          <div className="checklist-title">Checklist</div>
          {deliveryDateLabel ? (
            <div className="checklist-date">
              Delivery Date: {deliveryDateLabel}
            </div>
          ) : null}
        </div>
      </div>

      <table className="checklist-table">
        <thead>
          <tr>
            <th className="checklist-name-col">Name</th>
            <th className="checklist-driver-col">Driver/Pickup Details</th>
            <th className="checklist-instructions-col">Packing Instructions</th>
            <th className="checklist-products-col">Groceries</th>
            <th className="checklist-products-col">Frozen</th>
            <th className="checklist-products-col">Fresh Baked</th>
          </tr>
        </thead>

        <tbody>
          {checklistOrders.map((order) => {
            const groups = groupLineItems(order.lineItems);
            const checklistGroups = getChecklistLineItemGroups(groups);

            return (
              <tr key={order.id}>
                <td>
                  <div className="checklist-customer-name">
                    {order.customerName || "Customer Name"}
                  </div>
                </td>
                <td>{formatDriverPickupDetails(order)}</td>
                <td>{order.packingInstructions || ""}</td>
                <td>
                  <ChecklistItemLines
                    items={checklistGroups.groceries}
                    showSku
                  />
                </td>
                <td>
                  <ChecklistItemLines items={checklistGroups.frozen} showSku />
                </td>
                <td>
                  <ChecklistItemLines items={checklistGroups.baked} showSku />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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

function ChecklistItemLines({
  items,
  showSku = false,
}: {
  items: LineItem[];
  showSku?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <>
      {items.map((item) => {
        const quantity = getLineItemQuantity(item);
        const title = getLineItemDisplayName(item);
        const sku = item.sku?.trim();
        const details = showSku && sku ? `${sku} - ${title}` : title;

        return (
          <div className="checklist-item-line" key={item.id}>
            <strong>[{quantity}]</strong> {details}
          </div>
        );
      })}
    </>
  );
}

function ChecklistGroupedItemLines({
  groups,
  showSku = false,
}: {
  groups: ReturnType<typeof groupLineItems>;
  showSku?: boolean;
}) {
  const checklistGroceries = getChecklistGroceryLineItems(groups);

  return <ChecklistItemLines items={checklistGroceries} showSku={showSku} />;
}

function getChecklistVisibleOrders(orders: Order[]) {
  return orders
    .filter((order) => {
      const groups = groupLineItems(order.lineItems);
      return hasChecklistVisibleItems(groups);
    })
    .sort((firstOrder, secondOrder) =>
      (firstOrder.customerName || "").localeCompare(
        secondOrder.customerName || "",
        undefined,
        {
          sensitivity: "base",
          numeric: true,
        },
      ),
    );
}

function hasChecklistVisibleItems(groups: ReturnType<typeof groupLineItems>) {
  const checklistGroups = getChecklistLineItemGroups(groups);

  return (
    checklistGroups.groceries.length > 0 ||
    checklistGroups.frozen.length > 0 ||
    checklistGroups.baked.length > 0
  );
}

function getChecklistLineItemGroups(groups: ReturnType<typeof groupLineItems>) {
  return {
    groceries: getChecklistGroceryLineItems(groups),
    frozen: getChecklistFrozenLineItems(groups),
    baked: getChecklistBakedLineItems(groups),
  };
}

function getChecklistGroceryLineItems(
  groups: ReturnType<typeof groupLineItems>,
) {
  return sortLineItemsAlphabetically(
    [...groups.groceriesOnly, ...groups.produceAndGroceries].filter(
      (item) =>
        !isChecklistExcludedProduceItem(item) &&
        !isChecklistExcludedParentItem(item),
    ),
  );
}

function getChecklistFrozenLineItems(
  groups: ReturnType<typeof groupLineItems>,
) {
  return sortLineItemsAlphabetically(
    groups.frozen.filter((item) => !isChecklistExcludedParentItem(item)),
  );
}

function getChecklistBakedLineItems(groups: ReturnType<typeof groupLineItems>) {
  return sortLineItemsAlphabetically(
    groups.baked.filter((item) => !isChecklistExcludedParentItem(item)),
  );
}

function isChecklistExcludedProduceItem(item: LineItem) {
  const productType = normalizeProductType(item.productType);

  const itemText = normalizeProductType(
    [
      item.productType,
      item.variantTitle,
      item.title,
      item.productName,
      ...(item.tags || []),
    ].join(" "),
  );

  const itemNameText = normalizeProductType(
    [item.title, item.productName].join(" "),
  );

  if (itemNameText.includes("sandy creek gourmet produce")) {
    return true;
  }

  if (
    productType === "produce" ||
    productType === "fruit and veg" ||
    productType === "fruit and vegetables"
  ) {
    return true;
  }

  if (itemText.includes("produce only")) {
    return true;
  }

  return false;
}

function isChecklistExcludedParentItem(item: LineItem) {
  const itemNameText = normalizeProductType(
    [item.title, item.productName].join(" "),
  );

  if (itemNameText.includes("meal kit")) {
    return true;
  }

  const excludedParentNames = [
    "grass fed meat and seafood box",
    "wild caught salmon box",
    "wild caught fish box",
    "weeknight organic dinners box",
  ];

  return excludedParentNames.some((parentName) =>
    itemNameText.includes(parentName),
  );
}

function getLineItemQuantity(item: LineItem) {
  return Number(item.currentQuantity ?? 0);
}

function getLineItemDisplayName(item: LineItem) {
  return cleanLineItemName(item.productName || item.title || "");
}

function cleanLineItemName(value: string) {
  return (value || "").replace(/\s*[-–—]\s*default title\s*$/i, "").trim();
}

function formatLineItem(item: LineItem) {
  return `[${getLineItemQuantity(item)}] ${getLineItemDisplayName(item)}`;
}

function formatChecklistLineItem(item: LineItem) {
  const quantity = getLineItemQuantity(item);
  const title = getLineItemDisplayName(item);
  const sku = item.sku?.trim();

  if (!sku) {
    return `[${quantity}] ${title}`;
  }

  return `[${quantity}] ${sku} - ${title}`;
}

function getPackingSlipFooterContent(type: "Local Orders" | "Courier Orders") {
  if (type === "Courier Orders") {
    return {
      heading: "Courier Orders",
      body: "Your box might look a little overpacked, but that’s just to protect your goodies! Wherever possible, our packaging is recycled, reused or recyclable. Please reuse or recycle it if you can.",
      closing:
        "You just supported local farmers and made a kinder choice for the planet. 💚",
    };
  }

  return {
    heading: "Local Delivery",
    body: "Please leave your empty box out for collection with your next delivery. We also happily reuse clean plastic bottles as ice packs. Thanks for helping us reduce waste.",
    closing:
      "You just supported local farmers and made a kinder choice for the planet. 💚",
  };
}

async function exportSelectedOrdersToWord(
  orders: Order[],
  printMode: PrintMode,
) {
  const docx = await import("docx");
  const { saveAs } = await import("file-saver");
  const logoData = await fetchWordLogoData();

  if (printMode === "checklist") {
    const document = createChecklistWordDocument(docx, orders, logoData);
    const blob = await docx.Packer.toBlob(document);
    saveAs(blob, getWordExportFileName("checklist", orders));
    return;
  }

  const packingSlipType =
    printMode === "courierPackingSlip" ? "Courier Orders" : "Local Orders";

  const document = createPackingSlipsWordDocument(
    docx,
    orders,
    logoData,
    packingSlipType,
  );
  const blob = await docx.Packer.toBlob(document);
  saveAs(blob, getWordExportFileName(printMode, orders));
}

async function fetchWordLogoData() {
  const response = await fetch(LOGO_URL, {
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(
      `Unable to load the Joy Wholefoods logo (${response.status}).`,
    );
  }

  return new Uint8Array(await response.arrayBuffer());
}

function createPackingSlipsWordDocument(
  docx: any,
  orders: Order[],
  logoData: Uint8Array,
  type: "Local Orders" | "Courier Orders",
) {
  return new docx.Document({
    styles: getWordStyles(),
    sections: orders.map((order) => {
      const groups = getPackingSlipLineItemGroups(order.lineItems);
      const packingRouteDriverDateText =
        formatPackingSlipRouteDriverDate(order);

      return {
        properties: {
          page: {
            size: {
              width: 11906,
              height: 16838,
            },
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: [
          createWordLogoParagraph(docx, logoData, "right"),
          createWordParagraph(
            docx,
            `${order.customerName || "Customer Name"} ${order.name}`,
            {
              bold: true,
              size: PACKING_SLIP_WORD_FONT_SIZE,
              spacingAfter: 120,
            },
          ),
          createWordParagraph(docx, packingRouteDriverDateText, {
            bold: true,
            size: PACKING_SLIP_WORD_FONT_SIZE,
            spacingAfter: 120,
          }),
          createWordParagraph(docx, "Packer ID: __________", {
            size: PACKING_SLIP_WORD_FONT_SIZE,
            spacingAfter: 120,
          }),
          ...(order.boxPreference
            ? [
                createWordParagraph(
                  docx,
                  `Box Preference: ${order.boxPreference}`,
                  {
                    italics: true,
                    size: PACKING_SLIP_WORD_FONT_SIZE,
                    spacingAfter: 180,
                  },
                ),
              ]
            : []),
          new docx.Table({
            width: {
              size: 100,
              type: docx.WidthType.PERCENTAGE,
            },
            rows: [
              createWordTwoColumnRow(
                docx,
                "Produce",
                [...groups.produceOnly, ...groups.produceAndGroceries].map(
                  formatLineItem,
                ),
              ),
              createWordTwoColumnRow(
                docx,
                "Groceries",
                groups.groceriesOnly.map(formatLineItem),
              ),
              createWordTwoColumnRow(
                docx,
                "Frozen",
                groups.frozen.map(formatLineItem),
              ),
              createWordTwoColumnRow(
                docx,
                "Fresh Baked",
                groups.baked.map(formatLineItem),
              ),
            ],
          }),
          ...createWordPackingFooter(docx, type),
        ],
      };
    }),
  });
}

function createChecklistWordDocument(
  docx: any,
  orders: Order[],
  logoData: Uint8Array,
) {
  const checklistOrders = getChecklistVisibleOrders(orders);
  const deliveryDateLabel = getChecklistDeliveryDateLabel(checklistOrders);

  return new docx.Document({
    styles: getWordStyles(),
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 16838,
              height: 11906,
            },
            margin: {
              top: 567,
              right: 567,
              bottom: 720,
              left: 567,
            },
          },
        },
        children: [
          createWordLogoParagraph(docx, logoData, "right"),
          createWordParagraph(docx, "Checklist", {
            bold: true,
            size: 32,
            spacingAfter: deliveryDateLabel ? 60 : 180,
          }),
          ...(deliveryDateLabel
            ? [
                createWordParagraph(
                  docx,
                  `Delivery Date: ${deliveryDateLabel}`,
                  {
                    bold: true,
                    size: 20,
                    spacingAfter: 180,
                  },
                ),
              ]
            : []),
          new docx.Table({
            width: {
              size: 100,
              type: docx.WidthType.PERCENTAGE,
            },
            rows: [
              new docx.TableRow({
                tableHeader: true,
                children: [
                  createWordCell(docx, ["Name"], { bold: true, width: 14 }),
                  createWordCell(docx, ["Driver/Pickup Details"], {
                    bold: true,
                    width: 14,
                  }),
                  createWordCell(docx, ["Packing Instructions"], {
                    bold: true,
                    width: 18,
                  }),
                  createWordCell(docx, ["Groceries"], {
                    bold: true,
                    width: 18,
                  }),
                  createWordCell(docx, ["Frozen"], { bold: true, width: 18 }),
                  createWordCell(docx, ["Fresh Baked"], {
                    bold: true,
                    width: 18,
                  }),
                ],
              }),
              ...checklistOrders.map((order) => {
                const groups = groupLineItems(order.lineItems);
                const checklistGroups = getChecklistLineItemGroups(groups);

                return new docx.TableRow({
                  cantSplit: true,
                  children: [
                    createWordCell(
                      docx,
                      [order.customerName || "Customer Name"],
                      {
                        width: 14,
                      },
                    ),
                    createWordCell(
                      docx,
                      splitWordLines(formatDriverPickupDetails(order)),
                      {
                        width: 14,
                      },
                    ),
                    createWordCell(
                      docx,
                      splitWordLines(order.packingInstructions || ""),
                      { width: 18 },
                    ),
                    createWordChecklistItemsCell(
                      docx,
                      checklistGroups.groceries,
                      { width: 18 },
                    ),
                    createWordChecklistItemsCell(docx, checklistGroups.frozen, {
                      width: 18,
                    }),
                    createWordChecklistItemsCell(docx, checklistGroups.baked, {
                      width: 18,
                    }),
                  ],
                });
              }),
            ],
          }),
        ],
      },
    ],
  });
}

function getWordStyles() {
  return {
    default: {
      document: {
        run: {
          font: "Calibri",
        },
        paragraph: {
          spacing: {
            after: 0,
          },
        },
      },
    },
  };
}

function createWordLogoParagraph(
  docx: any,
  logoData: Uint8Array,
  alignment: "left" | "center" | "right" = "right",
) {
  const wordAlignment =
    alignment === "center"
      ? docx.AlignmentType.CENTER
      : alignment === "left"
        ? docx.AlignmentType.LEFT
        : docx.AlignmentType.RIGHT;

  return new docx.Paragraph({
    alignment: wordAlignment,
    spacing: {
      after: 120,
    },
    children: [
      new docx.ImageRun({
        data: logoData,
        type: "jpg",
        transformation: {
          width: 240,
          height: 48,
        },
      }),
    ],
  });
}

function createWordChecklistItemsCell(
  docx: any,
  items: LineItem[],
  options: {
    width?: number;
  } = {},
) {
  return new docx.TableCell({
    width: options.width
      ? {
          size: options.width,
          type: docx.WidthType.PERCENTAGE,
        }
      : undefined,
    margins: {
      top: 90,
      right: 90,
      bottom: 90,
      left: 90,
    },
    children:
      items.length > 0
        ? createWordChecklistItemParagraphs(docx, items)
        : [createWordParagraph(docx, "", { size: 18 })],
  });
}

function createWordChecklistGroupedItemsCell(
  docx: any,
  groups: ReturnType<typeof groupLineItems>,
  options: {
    width?: number;
  } = {},
) {
  const checklistGroceries = getChecklistGroceryLineItems(groups);

  return createWordChecklistItemsCell(docx, checklistGroceries, options);
}

function createWordChecklistItemParagraphs(docx: any, items: LineItem[]) {
  return items.map((item) => {
    const quantity = getLineItemQuantity(item);
    const title = getLineItemDisplayName(item);
    const sku = item.sku?.trim();
    const details = sku ? `${sku} - ${title}` : title;

    return new docx.Paragraph({
      spacing: {
        after: 40,
      },
      children: [
        new docx.TextRun({
          text: `[${quantity}]`,
          bold: true,
          size: 18,
          font: "Calibri",
        }),
        new docx.TextRun({
          text: ` ${details}`,
          size: 18,
          font: "Calibri",
        }),
      ],
    });
  });
}

function createWordPackingFooter(
  docx: any,
  type: "Local Orders" | "Courier Orders",
) {
  const footerContent = getPackingSlipFooterContent(type);

  return [
    createWordParagraph(docx, footerContent.body, {
      alignment: "center",
      size: PACKING_SLIP_WORD_FONT_SIZE,
      spacingBefore: 260,
      spacingAfter: 120,
    }),
    new docx.Paragraph({
      alignment: docx.AlignmentType.CENTER,
      spacing: {
        after: 120,
      },
      children: [
        new docx.TextRun({
          text: "Need help?",
          bold: true,
          size: PACKING_SLIP_WORD_FONT_SIZE,
          font: "Calibri",
        }),
        new docx.TextRun({
          text: ` Text us on ${SUPPORT_PHONE}.`,
          size: PACKING_SLIP_WORD_FONT_SIZE,
          font: "Calibri",
        }),
      ],
    }),
    createWordParagraph(docx, footerContent.closing, {
      alignment: "center",
      bold: true,
      size: PACKING_SLIP_WORD_FONT_SIZE,
      spacingAfter: 0,
    }),
  ];
}

function createWordTwoColumnRow(docx: any, label: string, lines: string[]) {
  return new docx.TableRow({
    cantSplit: true,
    children: [
      createWordCell(docx, [label], {
        bold: true,
        width: 28,
        fontSize: PACKING_SLIP_WORD_FONT_SIZE,
      }),
      createWordCell(docx, lines, {
        width: 72,
        fontSize: PACKING_SLIP_WORD_FONT_SIZE,
      }),
    ],
  });
}

function createWordCell(
  docx: any,
  lines: string[],
  options: {
    bold?: boolean;
    width?: number;
    fontSize?: number;
  } = {},
) {
  const safeLines = lines.length > 0 ? lines : [""];

  return new docx.TableCell({
    width: options.width
      ? {
          size: options.width,
          type: docx.WidthType.PERCENTAGE,
        }
      : undefined,
    margins: {
      top: 90,
      right: 90,
      bottom: 90,
      left: 90,
    },
    children: safeLines.map((line) =>
      createWordParagraph(docx, line, {
        bold: options.bold,
        size: options.fontSize || 18,
        spacingAfter: 40,
      }),
    ),
  });
}

function createWordParagraph(
  docx: any,
  text: string,
  options: {
    bold?: boolean;
    italics?: boolean;
    size?: number;
    alignment?: "left" | "center";
    spacingBefore?: number;
    spacingAfter?: number;
  } = {},
) {
  const alignment =
    options.alignment === "center"
      ? docx.AlignmentType.CENTER
      : docx.AlignmentType.LEFT;

  return new docx.Paragraph({
    alignment,
    spacing: {
      before: options.spacingBefore || 0,
      after: options.spacingAfter || 0,
    },
    children: [
      new docx.TextRun({
        text: text || "",
        bold: Boolean(options.bold),
        italics: Boolean(options.italics),
        size: options.size || 18,
        font: "Calibri",
      }),
    ],
  });
}

function splitWordLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getWordExportFileName(
  printMode: PrintMode | "checklist",
  orders: Order[],
) {
  const deliveryDate = getChecklistDeliveryDateLabel(orders)
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  const suffix = deliveryDate || new Date().toISOString().slice(0, 10);

  if (printMode === "checklist") {
    return `joy-checklist-${suffix}.docx`;
  }

  if (printMode === "courierPackingSlip") {
    return `joy-courier-packing-slips-${suffix}.docx`;
  }

  return `joy-local-packing-slips-${suffix}.docx`;
}

function getPackingSlipLineItemGroups(lineItems: LineItem[]) {
  return groupLineItems(
    lineItems.filter((item) => !isPackingSlipExcludedParentItem(item)),
  );
}

function isPackingSlipExcludedParentItem(item: LineItem) {
  return isSeasonalBoxLineItem(item) || isChecklistExcludedParentItem(item);
}

function groupLineItems(lineItems: LineItem[]) {
  const activeLineItems = lineItems.filter(
    (item) => getLineItemQuantity(item) > 0,
  );

  const groups = activeLineItems.reduce(
    (groupedItems, item) => {
      if (isSeasonalBoxLineItem(item)) {
        return groupedItems;
      }

      const category = getLineItemCategory(item);
      groupedItems[category].push(item);
      return groupedItems;
    },
    {
      groceriesOnly: [] as LineItem[],
      produceOnly: [] as LineItem[],
      produceAndGroceries: [] as LineItem[],
      frozen: [] as LineItem[],
      baked: [] as LineItem[],
    },
  );

  const groceriesOnly = sortLineItemsAlphabetically(groups.groceriesOnly);
  const produceOnly = sortLineItemsAlphabetically(groups.produceOnly);
  const produceAndGroceries = sortLineItemsAlphabetically(
    groups.produceAndGroceries,
  );
  const frozen = sortLineItemsAlphabetically(groups.frozen);
  const baked = sortLineItemsAlphabetically(groups.baked);

  return {
    groceriesOnly,
    produceOnly,
    produceAndGroceries,
    frozen,
    baked,
    fruit: produceOnly,
    grocery: [...groceriesOnly, ...produceOnly, ...produceAndGroceries],
  };
}

function sortLineItemsAlphabetically(items: LineItem[]) {
  return [...items].sort((firstItem, secondItem) => {
    const firstName = getLineItemSortableName(firstItem);
    const secondName = getLineItemSortableName(secondItem);

    const nameCompare = firstName.localeCompare(secondName, undefined, {
      numeric: true,
      sensitivity: "base",
    });

    if (nameCompare !== 0) {
      return nameCompare;
    }

    const displayNameCompare = getLineItemDisplayName(firstItem).localeCompare(
      getLineItemDisplayName(secondItem),
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    );

    if (displayNameCompare !== 0) {
      return displayNameCompare;
    }

    return (firstItem.sku || "").localeCompare(
      secondItem.sku || "",
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    );
  });
}

function getLineItemSortableName(item: LineItem) {
  return getLineItemDisplayName(item)
    .replace(
      /^\s*(?:\d+(?:\.\d+)?\s*(?:g|gm|gram|grams|kg|ml|l|lt|ltr|litre|litres|liter|liters|oz|lb|lbs|pack|packs|pc|pcs|piece|pieces|x)\b\s*[-–—:]?\s*)+/i,
      "",
    )
    .replace(/^\s*[-–—:]\s*/, "")
    .trim();
}

function isSeasonalBoxLineItem(item: LineItem) {
  const normalizedTags = (item.tags || []).map((tag) =>
    normalizeSearchText(tag)
      .replace(/&/g, "and")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );

  const parentBoxTags = new Set([
    "seasonal box",
    "parent box",
    "box parent",
    "bundle parent",
    "parent bundle",
  ]);

  if (normalizedTags.some((tag) => parentBoxTags.has(tag))) {
    return true;
  }

  const name = normalizeSearchText(getLineItemDisplayName(item))
    .replace(/&/g, "and")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const isOrganicFruitAndVegParent =
    /(?:^|\s)(?:(?:small|medium|large|extra large)\s+)?organic fruit and veg box$/.test(
      name,
    );

  const explicitParentBoxSuffixes = [
    "budget organic box",
    "ultimate organic farm box",
    "regen meat box",
    "organic staples box",
    "fruit only organic box",
    "veg only organic box",
    "big organic harvest box",
    "organic harvest box",
    "seasonal box",
  ];

  return (
    isOrganicFruitAndVegParent ||
    explicitParentBoxSuffixes.some(
      (parentName) => name === parentName || name.endsWith(` ${parentName}`),
    )
  );
}

function getLineItemCategory(
  item: LineItem,
):
  "groceriesOnly" | "produceOnly" | "produceAndGroceries" | "frozen" | "baked" {
  const productType = normalizeProductType(item.productType);
  const categoryText = normalizeProductType(
    [
      item.productType,
      item.variantTitle,
      item.title,
      item.productName,
      ...(item.tags || []),
    ].join(" "),
  );

  if (
    productType === "frozen" ||
    categoryText.includes(" frozen ") ||
    categoryText.endsWith(" frozen")
  ) {
    return "frozen";
  }

  if (
    productType === "bakery" ||
    productType === "fresh baked" ||
    categoryText.includes("fresh baked")
  ) {
    return "baked";
  }

  if (
    categoryText.includes("produce and groceries") ||
    categoryText.includes("groceries and produce") ||
    categoryText.includes("produce groceries") ||
    categoryText.includes("groceries produce")
  ) {
    return "produceAndGroceries";
  }

  if (
    productType === "fruit and veg" ||
    productType === "fruit and vegetables" ||
    productType === "produce" ||
    categoryText.includes("produce only") ||
    categoryText.includes("fruit and veg") ||
    categoryText.includes("fruit and vegetables")
  ) {
    return "produceOnly";
  }

  return "groceriesOnly";
}

function normalizeProductType(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatShippingAddress(order: Order) {
  return [order.address, order.city, order.province, order.zip, order.country]
    .filter(Boolean)
    .join(", ");
}

function formatBoxLabelAddress(order: Order) {
  return [order.address, order.city].filter(Boolean).join(", ");
}

function getAllowedBoxPreference(value: string) {
  const rawValue = value?.trim() || "";
  const normalizedValue = rawValue.toLowerCase().replace(/[’`]/g, "'");

  if (normalizedValue === "styrofoam" || normalizedValue === "cardboard box") {
    return rawValue;
  }

  return "";
}

function isCourierOrder(order: Order) {
  return normalizeSearchText(order.easyRoutesRoute).includes("courier");
}

function formatPackingSlipRouteDriverDate(order: Order) {
  const easyRoutesRoute = order.easyRoutesRoute?.trim();

  if (easyRoutesRoute) {
    return easyRoutesRoute;
  }

  const deliveryLocation = order.deliveryLocation?.trim();
  const driverName = order.driverName?.trim();
  const deliveryDate = order.deliveryDate?.trim();

  if (deliveryLocation || driverName) {
    return [deliveryLocation, driverName, deliveryDate]
      .filter(Boolean)
      .join(" - ");
  }

  return "";
}

function formatDriverPickupDetails(order: Order) {
  if (normalizeSearchText(order.pickupLocationCompany) === "rocklea") {
    return "Rocklea Pickup";
  }

  return order.driverName?.trim() || "";
}

function getChecklistDeliveryDateLabel(orders: Order[]) {
  const dates = Array.from(
    new Set(
      orders
        .map((order) => order.deliveryDate || order.deliveryDay)
        .filter(Boolean),
    ),
  );

  return dates.join(", ");
}

function sortOrdersForPackingAndLabels(orders: Order[]) {
  return [...orders].sort((firstOrder, secondOrder) => {
    const firstGroup = getPackingOrderGroup(firstOrder);
    const secondGroup = getPackingOrderGroup(secondOrder);

    if (firstGroup !== secondGroup) {
      return firstGroup - secondGroup;
    }

    const firstCustomerName = normalizeSearchText(
      firstOrder.customerName || firstOrder.name,
    );
    const secondCustomerName = normalizeSearchText(
      secondOrder.customerName || secondOrder.name,
    );

    return firstCustomerName.localeCompare(secondCustomerName, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function getPackingOrderGroup(order: Order) {
  const groups = groupLineItems(order.lineItems);

  const hasProduce =
    groups.produceOnly.length > 0 || groups.produceAndGroceries.length > 0;

  const hasGroceryFrozenOrBaked =
    groups.groceriesOnly.length > 0 ||
    groups.frozen.length > 0 ||
    groups.baked.length > 0;

  if (!hasProduce) {
    return 1;
  }

  if (hasProduce && !hasGroceryFrozenOrBaked) {
    return 2;
  }

  return 3;
}

function parseDriverFromEasyRoutesRoute(route: string) {
  if (!route) return "";

  const parts = route
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return "";
  }

  const possibleDriver = parts[1];
  const normalizedPossibleDriver = normalizeSearchText(possibleDriver);

  const looksLikeDate =
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(possibleDriver) ||
    /^\d{4}-\d{2}-\d{2}/.test(possibleDriver);

  if (looksLikeDate || normalizedPossibleDriver.includes("courier")) {
    return "";
  }

  return possibleDriver;
}

function getCurrentOrderDeliveryInstructions(order: {
  orderDeliveryInstructionsMetafield?: { value?: string | null } | null;
}) {
  return (order.orderDeliveryInstructionsMetafield?.value || "").trim();
}

function getCurrentOrderPackingInstructions(order: {
  orderPackingInstructionsMetafield?: { value?: string | null } | null;
}) {
  return (order.orderPackingInstructionsMetafield?.value || "").trim();
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

async function postAuthenticatedJson(
  actionUrl: string,
  payload: unknown,
) {
  const shopifyAppBridge = (
    window as Window & {
      shopify?: {
        idToken?: () => Promise<string>;
      };
    }
  ).shopify;

  if (!shopifyAppBridge?.idToken) {
    throw new Error(
      "Shopify authentication is not ready. Please refresh the app and try again.",
    );
  }

  const token = await shopifyAppBridge.idToken();

  return fetch(actionUrl, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/,/g, "").replace(/\s+/g, " ").trim();
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];

  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }

  return result;
}

function getPrintButtonLabel(printMode: PrintMode) {
  if (printMode === "courierLabels") return "Print Courier Box Labels";
  if (printMode === "localPackingSlip") return "Print Local Packing Slips";
  if (printMode === "courierPackingSlip") return "Print Courier Packing Slips";
  if (printMode === "checklist") return "Print Checklist";
  return "Print Local Box Labels";
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

  if (printMode === "localPackingSlip" || printMode === "courierPackingSlip") {
    return `
      @page {
        size: A4 portrait;
        margin: 0;
      }
    `;
  }
  // page size for box labels is set in the CSS file (box-labels.css) to ensure proper scaling and layout for printing.

  return `
    @page {
      size: A4 portrait;
      margin: 0;
    }
  `;
}
