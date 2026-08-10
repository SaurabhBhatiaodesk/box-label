import { authenticate } from "../shopify.server";

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
        orders(first: 1, query: $query) {
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
          query: `name:${q}`,
        },
      },
    );

    const data = await response.json();
    const edge = data?.data?.orders?.edges?.[0];

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
          productName: (item.name || item.title || item.product?.title || "").replace(/\s+/g, " ").trim(),
          quantity: Number(item.quantity || 0),
          currentQuantity: Number(item.currentQuantity || 0),
          unfulfilledQuantity: Number(item.unfulfilledQuantity || 0),
          variantTitle: item.variantTitle || "",
          sku: item.variant?.sku || "",
          productType: item.product?.productType || "",
          tags: item.product?.tags || [],
        };
      }) || [];

    const mapped = {
      id: order.id,
      name: order.name,
      createdAt: order.createdAt,
      note: order.note || "",
      customerName:
        shipping?.name || `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim(),
      address: [shipping?.address1, shipping?.address2].filter(Boolean).join(", "),
      city: shipping?.city || "",
      province: shipping?.province || "",
      country: shipping?.country || "",
      zip: shipping?.zip || "",
      phone: shipping?.phone || order.customer?.phone || "",
      deliveryMethod: "",
      customerTimeZone: "",
      deliveryPostalCode: "",
      locationId: "",
      shopifyLocationId: "",
      deliveryDate: "",
      deliveryDay: "",
      checkoutMethod: "",
      deliveryLocation: "",
      pickupLocationId: "",
      pickupLocationCompany: "",
      pickupLocationAddressLine1: "",
      pickupLocationCity: "",
      pickupLocationRegion: "",
      pickupLocationPostalCode: "",
      pickupLocationCountry: "",
      pickupDetails: "",
      easyRoutesRoute: "",
      easyRoutesStopNumber: "",
      easyRoutesRouteStart: "",
      easyRoutesStopEta: "",
      driverName: "",
      boxPreference: "",
      deliveryInstructions: order.orderDeliveryInstructionsMetafield?.value || "",
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
