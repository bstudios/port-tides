import { etagForMonth, secondsLeftIMonth } from "@/cacheTimings";
import { Accordion, Button, Card, Group, SimpleGrid, Text } from "@mantine/core";
import { IconDownload, IconHome } from "@tabler/icons-react";
import { createFileRoute, Link } from '@tanstack/react-router';
import { DateTime } from "luxon";
import Layout from "../../components/navigation/Layout";
import { getTideTablesByYear } from "../../readTideTimes";
export const Route = createFileRoute('/tide-tables/')({
  component: Page,
  loader: async () => {
    const { years, month } = await getTideTablesByYear();
    return { years, month };
  },
  head: () => ({
    meta: [
      {
        title: 'Downloadable Tide Tables | Porthmadog Tide Times',
      },
      {
        name: 'description',
        content: 'Downloadable tide tables for Porthmadog, Borth-y-gest, Morfa Bychan and Black Rock Sands',
      },
    ],

    links: [
      {
        rel: 'canonical',
        href: `https://port-tides.com/tide-tables`,
      },
    ],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Downloadable Tide Tables',
          description: 'Download free printable tide tables for Porthmadog, Borth-y-gest, and Black Rock Sands. Available in monthly PDF format.',
          author: {
            '@type': 'Organization',
            name: 'Porthmadog Tide Times',
          },
          datePublished: new Date().toISOString(),
        }),
      },
    ],
  }),
  headers: async () => {
    // Cache the page for the duration of the month, as essentially the page only ever changes at the end of the month when a new month is added
    const expiry = await secondsLeftIMonth()
    const etag = await etagForMonth()
    return {
      'Cache-Control': `public, max-age=${expiry}, s-maxage=${expiry}, must-revalidate`,
      'ETag': etag,
    }
  },
})
function Page() {
  const { years, month } = Route.useLoaderData();
  // `month` is the Europe/London start of month as an absolute instant, so read
  // the year back in that zone - getFullYear() would use the viewer's zone and
  // pick the previous year for visitors west of London each January.
  const currentYear = DateTime.fromJSDate(month).setZone("Europe/London").year;
  return (
    <Layout
      title="Downloadable Tide Tables"
      headerButtons={
        <Link to={"/"}>
          <Button leftSection={<IconHome size={14} />} variant="light">
            Homepage
          </Button>
        </Link>
      }
    >
      <Accordion
        multiple
        defaultValue={[currentYear + "-tab", currentYear + 1 + "-tab"]}
      >
        {years.map((year) => (
          <Accordion.Item key={year.year} value={year.year + "-tab"}>
            <Accordion.Control>
              <Text size="xl" fw={500} mb={"xs"}>
                {year.year}
              </Text>
            </Accordion.Control>
            <Accordion.Panel>
              <SimpleGrid cols={{ base: 1, sm: 3, md: 4 }}>
                {year.months.map((month, index) => (
                  <Link
                    to={"/tide-tables/" + month.url}
                    style={{ textDecoration: "none" }}
                    key={index}
                  >
                    <Card shadow="xs" padding={"xs"} key={index}>
                      <Group justify="space-between">
                        <Text size="xl" fw={500} mb={"xs"}>
                          {month.name}
                        </Text>
                        <IconDownload />
                      </Group>
                    </Card>
                  </Link>
                ))}
              </SimpleGrid>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Layout>
  );
};