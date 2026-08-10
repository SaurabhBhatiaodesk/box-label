import { authenticate } from "../shopify.server";

type CustomAttribute = {
  key: string;
  value: string;
};

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
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

function getOrderValue(
  order: { customAttributes?: CustomAttribute[]; note?: string },
  noteKey: string,
  customKeys: string[],
) {
  return (
    getCustomValue(order.customAttributes || [], customKeys) ||
    getNoteValue(order.note || "", noteKey) ||
    ""
  );
}

function parseDriverFromEasyRoutesRoute(route: string) {
  if (!route) return "";

  const parts = route
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return "";

  const possibleDriver = parts[1];
  const normalized = possibleDriver.toLowerCase();
  const looksLikeDate =
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(possibleDriver) ||
    /^\d{4}-\d{2}-\d{2}/.test(possibleDriver);

  if (looksLikeDate || normalized.includes("courier")) return "";
  return possibleDriver;
}

export const loader = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const raw = (url.searchParams.get("q") || "").trim();
  const q = raw.replace(/[^0-9]/g, "");

  if (!q) {
    return new Response(JSON.stringify({ order: null }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { admin } = await authenticate.admin(request);

  try {
    const response: any = await admin.graphql(
      `#graphql
      query FindOrder($query: String!) {
        orders(first: 5, query: $query, sortKey: CREATED_AT, reverse: true) {
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
      }
    `,
      {
        variables: {
          // Shopify order names are usually "#1234" — try exact + bare number.
          query: `name:#${q} OR name:${q}`,
        },
      },
    );

    const data = await response.json();
    const edges = data?.data?.orders?.edges || [];

    // Prefer exact name match (#q or q) over partial hits.
    const edge =
      edges.find((e: any) => {
        const name = String(e?.node?.name || "").replace(/^#/, "");
        return name === q;
      }) || edges[0];

    if (!edge) {
      return new Response(JSON.stringify({ order: null }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const order = edge.node;
    const shipping = order.shippingAddress || {};

    const lineItems =
      order.lineItems?.edges?.map((lineEdge: any) => {
        const item = lineEdge.node;

        return {
          id: item.id,
          title: item.title || item.product?.title || "",
          productName: (item.name || item.title || item.product?.title || "")
            .replace(/\s+/g, " ")
            .trim(),
          quantity: Number(item.quantity || 0),
          currentQuantity: Number(item.currentQuantity || 0),
          unfulfilledQuantity: Number(item.unfulfilledQuantity || 0),
          variantTitle: item.variantTitle || "",
          sku: item.variant?.sku || "",
          productType: item.product?.productType || "",
          tags: item.product?.tags || [],
        };
      }) || [];

    const deliveryMethod = getOrderValue(order, "Delivery Method", [
      "Delivery Method",
      "delivery_method",
      "deliveryMethod",
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
    const deliveryLocation = getOrderValue(order, "Delivery Location", [
      "Delivery Location",
      "delivery_location",
      "deliveryLocation",
      "Delivery Zone",
      "delivery_zone",
      "deliveryZone",
      "Zone",
      "zone",
    ]);
    const easyRoutesRoute = getOrderValue(order, "EasyRoutes Route", [
      "EasyRoutes Route",
      "easyroutes_route",
      "easyRoutesRoute",
      "easy-routes-route",
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

    const mapped = {
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
      customerTimeZone: "",
      deliveryPostalCode: "",
      locationId: "",
      shopifyLocationId: "",
      deliveryDate,
      deliveryDay,
      checkoutMethod: "",
      deliveryLocation,
      pickupLocationId: "",
      pickupLocationCompany: "",
      pickupLocationAddressLine1: "",
      pickupLocationCity: "",
      pickupLocationRegion: "",
      pickupLocationPostalCode: "",
      pickupLocationCountry: "",
      pickupDetails: "",
      easyRoutesRoute,
      easyRoutesStopNumber,
      easyRoutesRouteStart,
      easyRoutesStopEta,
      driverName,
      boxPreference: "",
      deliveryInstructions:
        order.orderDeliveryInstructionsMetafield?.value || "",
      packingInstructions: order.orderPackingInstructionsMetafield?.value || "",
      lineItems,
    };

    return new Response(JSON.stringify({ order: mapped }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Order lookup failed:", err);
    return new Response(JSON.stringify({ order: null }), {
      headers: { "Content-Type": "application/json" },
    });
  }
};
