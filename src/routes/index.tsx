import { getHomepageTides } from "@/readTideTimes";
import {
  Badge,
  Button,
  Card,
  Center,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
  useMatches
} from "@mantine/core";
import {
  IconArrowRight,
  IconCalendar,
  IconChartHistogram,
  IconDownload,
  IconRippleDown,
  IconRippleUp,
  IconTable
} from "@tabler/icons-react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { DateTime } from "luxon";
import * as React from "react";
import { findNextHighTide } from "../nextHighTide";
import Layout from "../components/navigation/Layout";

export const Route = createFileRoute('/')({
  component: App,
  loader: async () => {
    return getHomepageTides({ data: { daysToDisplay: 10 } }) // Fetch the maximum needed (10) so it's available for all screen sizes
  },
  headers: async () => {
    return {
      'Cache-Control': `public, max-age=${60}, s-maxage=${60 * 5}, must-revalidate`,
    }
  },
  head: () => ({
    links: [
      {
        rel: 'canonical',
        href: `https://port-tides.com`,
      },
    ],
  }),
})

function App() {
  const { homepageTides, today, homepageFiles, nextHighTide: renderedNextHighTide } = Route.useLoaderData()
  // `today` is the Europe/London start of day as an absolute instant. Read it
  // back in that zone rather than the viewer's, otherwise a visitor west of
  // London gets yesterday's date in these links and month name.
  const londonToday = DateTime.fromJSDate(today).setZone("Europe/London");

  // The countdown is worked out when the page is rendered, but that render can
  // be served from the edge cache (s-maxage 300) and the page can sit open in a
  // background tab or come back from bfcache long after that. Recompute it in
  // the browser from the tide data already in the loader - no network needed.
  // Seeded with the server's value so the first render matches the SSR markup.
  const [nextHighTide, setNextHighTide] = React.useState(renderedNextHighTide);
  const computedAt = React.useRef(Date.now());
  const refetched = React.useRef(false);
  const router = useRouter();

  React.useEffect(() => {
    const STALE_AFTER_MS = 5 * 60 * 1000;
    const recompute = () => {
      computedAt.current = Date.now();
      const next = findNextHighTide(homepageTides);
      setNextHighTide(next);
      // Left open long enough to outlast the ten days the loader fetched, so
      // the tide cards are stale too. Refetch, once, rather than silently
      // dropping the heading.
      if (!next && !refetched.current) {
        refetched.current = true;
        router.invalidate();
      }
    };
    const recomputeIfStale = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - computedAt.current < STALE_AFTER_MS) return;
      recompute();
    };
    // On mount regardless of age: the markup we hydrated may itself have been
    // sitting in a cache for up to five minutes before it reached the browser.
    recompute();
    document.addEventListener("visibilitychange", recomputeIfStale);
    window.addEventListener("focus", recomputeIfStale);
    window.addEventListener("pageshow", recomputeIfStale);
    return () => {
      document.removeEventListener("visibilitychange", recomputeIfStale);
      window.removeEventListener("focus", recomputeIfStale);
      window.removeEventListener("pageshow", recomputeIfStale);
    };
  }, [homepageTides, router]);
  const daysToDisplay = useMatches({ base: 3, sm: 6, md: 8, lg: 10, xl: 10 }) as number;
  const tidesToDisplay = homepageTides.slice(0, daysToDisplay);

  return (
    <Layout>
      <Center>
        <Stack align="center" gap={"sm"}>
          <Title order={1} size={"h1"} mb={0}>
            Porthmadog Tide Times
          </Title>
          <Text fw={200}>North Wales, United Kingdom</Text>
        </Stack>
      </Center>
      {nextHighTide && (
        <Group justify="space-between" mb="sm" mt="sm">
          <Title order={2} size={"h2"} my="sm">
            Next High Tide is in {nextHighTide.hours > 0 ? `${nextHighTide.hours} hour${nextHighTide.hours > 1 ? "s" : ""} ` : ""}{nextHighTide.minutes} minute{nextHighTide.minutes !== 1 ? "s" : ""} at {nextHighTide.time} ({nextHighTide.height}m)
          </Title>
          {((nextHighTide.hours > 1 || (nextHighTide.hours === 0 && nextHighTide.minutes > 30)) && (nextHighTide.hours < 5 || nextHighTide.hours > 7)) && <Badge size="xl" leftSection={nextHighTide.hours < 5 ? <IconRippleUp size={18} /> : <IconRippleDown size={18} />}>{nextHighTide.hours < 5 ? "Tide is coming in" : "Tide is going out"}</Badge>}{/** Don't show if the tide is less than 30 minutes away as the top of the tide is not an exact science with river flows, or if it's between 5 and 7 hours away as the bottom of the tide is ambigiously timed */}
        </Group>
      )}
      <Group justify="space-between" mb="sm" mt="sm">
        <Title order={2} size={"h3"}>
          High Tide Times this week
        </Title>
        <Group justify="flex-end">
          <Link
            to={
              "/tide-graph/" + londonToday.toFormat("yyyy-LL-dd")
            }
            style={{ textDecoration: "none" }}
          >
            <Button
              rightSection={<IconChartHistogram size={14} />}
              variant="light"
              visibleFrom="sm"
            >
              Today's Graph
            </Button>
          </Link>
          <Link
            to={"tide-tables/" + londonToday.toFormat("yyyy/LL")}
          >
            <Button
              leftSection={<IconTable size={14} />}
              variant="light"
              visibleFrom="sm"
            >
              {londonToday.toFormat("MMMM")}{" "}
              Tide Table
            </Button>
          </Link>
        </Group>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 3, md: 4, lg: 5, xl: 5 }}>
        {tidesToDisplay.map((element, index: React.Key) => (
          <Card shadow="xs" padding={"xs"} key={index}>
            <Text size="xl" fw={500} mb={"xs"}>
              {DateTime.fromSQL(element.date).toFormat("cccc dd MMMM")}
            </Text>
            {element.groups.map((tide) => (
              <Group justify="start" mt={0} mb={0} key={tide.time}>
                <Text size="lg" fw={500}>
                  {DateTime.fromSQL(
                    element.date + " " + tide.time
                  ).toFormat("HH:mm")}
                </Text>
                <Text size="lg" fw={200}>
                  {tide.height}m
                </Text>
              </Group>
            ))}
          </Card>
        ))}
        <Link
          to={
            "/tide-graph/" + londonToday.toFormat("yyyy-LL-dd")
          }
          style={{ textDecoration: "none" }}
        >
          <Card shadow="xs" padding={"xs"} hiddenFrom="sm">
            <Group justify="space-between">
              <Text size="xl" fw={500}>
                Today's Graph
              </Text>
              <IconChartHistogram />
            </Group>
          </Card>
        </Link>
        <Link
          to={"/tide-tables/" + londonToday.toFormat("yyyy/LL")}
          style={{ textDecoration: "none" }}
        >
          <Card shadow="xs" padding={"xs"} hiddenFrom="sm">
            <Group justify="space-between">
              <Text size="xl" fw={500}>
                {londonToday.toFormat("MMMM")}{" "}
                Tide Table
              </Text>
              <IconArrowRight />
            </Group>
          </Card>
        </Link>
      </SimpleGrid>
      <Group justify="space-between" mb="sm" mt="sm">
        <Title order={2} size={"h3"}>
          Monthly Tide Tables
        </Title>
        <Group justify="flex-end">
          <Link to={"/ical"}>
            <Button rightSection={<IconCalendar size={14} />} variant="light">
              Add to Calendar
            </Button>
          </Link>
          <Link to={"/tide-tables"}>
            <Button rightSection={<IconArrowRight size={14} />} variant="light">
              View All
            </Button>
          </Link>
        </Group>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 3, md: 4 }}>
        {homepageFiles.map((month, index) => (
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
    </Layout>
  );
};