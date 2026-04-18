import {
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Paper,
  rem,
  Text
} from "@mantine/core";
import {
  IconAlertTriangleFilled,
  IconArrowLeft,
  IconArrowRight,
  IconHome,
} from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DateTime } from "luxon";
// Use relative path for data to be safe or verify alias
import { DataInformation } from "@/components/navigation/DataInformation";
import Layout from "@/components/navigation/Layout";
import { TidalGraph } from "@/components/tideGraph/TidalGraph";
import { getTidesForGraph } from "@/readTideTimes";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";

export const Route = createFileRoute("/tide-graph/$date")({
  loader: async ({ params }) => {
    const { date } = params;
    const { day, nextDay, previousDay, highTides, graphStartTimestamp, graphEndTimestamp } = await getTidesForGraph({
      data: {
        date,
      },
    });
    return { day, nextDay, previousDay, highTides, graphStartTimestamp, graphEndTimestamp };
  },
  component: TideGraphPageComponent,
  head: ({ loaderData }) => {
    const day = loaderData?.day;
    if (!day) return { meta: [] };
    const pageTitle =
      DateTime.fromSQL(day.date).toFormat("d MMMM yyyy") + " Porthmadog Tide Graph";

    return {
      meta: [
        { title: pageTitle },
      ],
      links: [
        {
          rel: 'canonical',
          href: `https://port-tides.com/tide-graph/${day.date}`,
        },
      ],
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: pageTitle,
            description: `Porthmadog tide times for ${pageTitle}. High and low tide times and heights.`,
            author: {
              '@type': 'Organization',
              name: 'Porthmadog Tide Times',
            },
            datePublished: new Date().toISOString(),
            mainEntity: {
              '@type': 'Dataset',
              name: pageTitle,
              description: `Tide table data for Porthmadog for ${pageTitle}`,
              license: 'https://creativecommons.org/licenses/by/4.0/',
            }
          }),
        },
      ],
    };
  },
  headers: () => {
    return {
      'Cache-Control': `public, max-age=604800, s-maxage=31536000`, // Cache for 7 days client side, 1 year CDN side
    }
  },
});

const Warning = () => {
  return (
    <Box p={0}>
      <Group justify="flex-start" mb="sm" maw={"100%"}>
        <Badge
          color="red"
          size="xl"
          leftSection={
            <IconAlertTriangleFilled
              style={{ width: rem(15), height: rem(15) }}
            />
          }
        >
          Warning
        </Badge>
        <Text fw={500} tt="uppercase">
          Not to be used for navigation
        </Text>
      </Group>
      <Text>
        {" "}
        Tide Graphs for Porthmadog are not published by authoritative sources and should be considered highly unreliable due to seasonal river flows and poorly understood tidal dynamics in the estuary. This graph is produced by extrapolating from published high water times and heights.
      </Text>
    </Box>
  );
};


function TideGraphPageComponent() {
  const { day, nextDay, previousDay, highTides, graphStartTimestamp, graphEndTimestamp } = Route.useLoaderData();
  const [warningModalOpened, { close: closeWarningModal }] = useDisclosure(true);
  const isMobile = useMediaQuery('(max-width: 50em)');
  return (
    <Layout
      title={
        DateTime.fromSQL(day.date).toFormat("d MMMM yyyy") + " Porthmadog Tide Graph"
      }
      headerButtons={
        <>
          {previousDay ? (
            <Link to={"/tide-graph/$date"} params={{ date: previousDay }}>
              <Button leftSection={<IconArrowLeft size={14} />} variant="light">
                {DateTime.fromSQL(previousDay).toFormat("d MMM")}
              </Button>
            </Link>
          ) : null}
          <Link to={"/"}>
            <Button variant="light">
              <IconHome size={14} />
            </Button>
          </Link>
          {nextDay ? (
            <Link to={"/tide-graph/$date"} params={{ date: nextDay }}>
              <Button
                leftSection={<IconArrowRight size={14} />}
                variant="light"
              >
                {DateTime.fromSQL(nextDay).toFormat("d MMM")}
              </Button>
            </Link>
          ) : null}
        </>
      }
    >
      <Modal opened={warningModalOpened} fullScreen={isMobile} withCloseButton={false} onClose={closeWarningModal} centered={!isMobile} overlayProps={{
        backgroundOpacity: 0.55,
        blur: 3,
      }}>
        <Warning />
        <Group justify="right" mt="md">
          <Button onClick={closeWarningModal}>Acknowledge</Button>
        </Group>
      </Modal>
      <TidalGraph
        highTides={highTides}
        sunrise={DateTime.fromSQL(day.date + " " + day.sunrise, { zone: 'Europe/London' }).toMillis() / 1000}
        sunset={DateTime.fromSQL(day.date + " " + day.sunset, { zone: 'Europe/London' }).toMillis() / 1000}
        startTimestamp={graphStartTimestamp.getTime() / 1000}
        endTimestamp={graphEndTimestamp.getTime() / 1000}
      />
      <Box p="sm">
        <DataInformation />
      </Box>
      <Paper withBorder p="md">
        <Warning />
      </Paper>

    </Layout>
  );
}
