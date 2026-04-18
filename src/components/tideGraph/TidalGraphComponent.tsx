import { LineChart } from "@mantine/charts";
import { Box, Center, Divider, Group, NumberInput, Paper, SegmentedControl, Stack, Switch, Text } from "@mantine/core";
import { TimePicker } from '@mantine/dates';
import { useLocalStorage, useMediaQuery } from "@mantine/hooks";
import { IconArrowDown, IconArrowUp, IconClock, IconLineHeight, IconMinus } from "@tabler/icons-react";
import { DateTime } from "luxon";
import classes from './TidalGraph.module.css';

interface ChartTooltipProps {
  label: string;
  payload: Record<string, any>[] | undefined;
  highTides: Array<{ timestamp: number; height: number }>;
}

function ChartTooltip({ label, payload, highTides }: ChartTooltipProps) {
  if (!payload) return null;
  const currentTide = highTides.find(
    (tide) => tide.timestamp === Number(label)
  );
  return (
    <Paper px="md" py="sm" withBorder shadow="md" radius="md">
      <Text fw={500} mb={5}>
        {DateTime.fromMillis(Number(label) * 1000).setZone('Europe/London').toFormat("d MMM yyyy, HH:mm")}
      </Text>
      {payload.map((item: any) => (
        <Text key={item.name} c={item.color} fz="sm">
          {item.name}: {item.value}m
        </Text>
      ))}
      {currentTide === undefined && (
        <Text c="red" fz="sm">
          Caution: Estimated tide height
        </Text>
      )}
    </Paper>
  );
}
const defaultConfig = {
  showSunriseSunset: true,
  showMHWSMHWN: true,
  showMLWNMLWS: false,
  showHighTides: true,
  toolMode: 'none' as 'height' | 'time' | 'none',
  targetHeight: 3.0,
  targetTime: null as string | null,
};

/**
 * Finds the times at which the tide reaches a specific height.
 * Also determines if the tide is rising, falling, or "flat" (at a peak or trough) 
 * by examining the surrounding data points.
 */
function findTimesForHeight(graphData: Array<{ date: number; Height: number }>, targetHeight: number) {
  const results: { time: number; direction: 'rising' | 'falling' | 'flat' }[] = [];

  // Iterate through graph data, staying within bounds to allow checking neighbors
  for (let i = 1; i < graphData.length - 2; i++) {
    const p1 = graphData[i];
    const p2 = graphData[i + 1];

    // Check if the target height falls between these two points
    if ((p1.Height <= targetHeight && p2.Height >= targetHeight) || (p1.Height >= targetHeight && p2.Height <= targetHeight)) {
      let time: number;
      if (p1.Height === p2.Height) {
        time = p1.date;
      } else {
        // Linear interpolation to find more accurate time between minutes
        const fraction = (targetHeight - p1.Height) / (p2.Height - p1.Height);
        const interpolatedTime = p1.date + fraction * (p2.date - p1.date);
        time = Math.round(interpolatedTime);
      }

      // To find direction, we check the points immediately before and after this window.
      // This helps identify if we are at a peak (high tide) or trough (low tide).
      const prev = graphData[i - 1];
      const next = graphData[i + 2];

      let direction: 'rising' | 'falling' | 'flat';

      // Determine if this is a turning point (peak or trough)
      const isPeak = p1.Height >= prev.Height && p2.Height >= next.Height;
      const isTrough = p1.Height <= prev.Height && p2.Height <= next.Height;

      // If the height difference over this 3-minute window is negligible, or it's a turning point, call it flat
      if (isPeak || isTrough || Math.abs(next.Height - prev.Height) < 0.002) {
        direction = 'flat';
      } else {
        direction = p2.Height > p1.Height ? 'rising' : 'falling';
      }

      results.push({ time, direction });
    }
  }

  // Filter out results that are very close (within 5 minutes) to avoid multiple 
  // hits on the same tide crossing, especially at flat peaks/troughs.
  return results.filter((r, i) => i === 0 || r.time - results[i - 1].time > 300);
}
export function TidalGraphComponent({
  highTides,
  sunrise,
  sunset,
  startTimestamp,
  endTimestamp,
  graphData,
}: {
  highTides: Array<{ timestamp: number; height: number }>;
  sunrise: number;
  sunset: number;
  startTimestamp: number;
  endTimestamp: number;
  graphData: Array<{ date: number; Height: number }>;
}) {
  const isMobile = useMediaQuery('(max-width: 50em)');
  const [config, setLocalStorageConfig] = useLocalStorage({
    key: 'tidal-graph-config',
    defaultValue: defaultConfig,
  });
  const setConfig = (update: Partial<typeof defaultConfig> | ((current: typeof defaultConfig) => Partial<typeof defaultConfig>)) => {
    setLocalStorageConfig((prev) => ({
      ...prev,
      ...(typeof update === 'function' ? update(prev) : update),
    }));
  };
  const todayGraphData = graphData.filter(
    (data) =>
      data.date >= startTimestamp &&
      data.date <= endTimestamp &&
      data.Height >= 0
  );

  // When the tool mode is time, find the height of the tide at that time
  const effectiveTargetHeight = (config.toolMode === 'time' && config.targetTime !== null
    ? (todayGraphData.find(d => DateTime.fromMillis(d.date * 1000).setZone('Europe/London').toFormat("HHmm") === config.targetTime)?.Height ?? config.targetHeight)
    : config.targetHeight) ?? defaultConfig.targetHeight;
  const resultTimes = config.toolMode !== 'none' ? findTimesForHeight(todayGraphData, effectiveTargetHeight) : [];
  return (
    <>
      <LineChart
        h={800}
        className={classes.root}
        data={todayGraphData}
        gridAxis="none"
        dataKey="date"
        xAxisLabel="Date"
        yAxisLabel="Height"
        yAxisProps={{
          domain: [0, 5.5],
          allowDataOverflow: false,
          interval: "equidistantPreserveStart",
          tickCount: 28,
          type: "number",
        }}
        xAxisProps={{
          tickFormatter: (value: number) =>
            DateTime.fromMillis(value * 1000).setZone('Europe/London').toFormat("h a"),
          padding: { left: 30, right: 30 },
          interval: "equidistantPreserveStart",
          allowDecimals: false,
          domain: [startTimestamp, endTimestamp],
          type: "number",
          ticks: Array.from(Array(25).keys()).map(
            (i) => startTimestamp + i * 60 * 60
          ),
        }}
        tooltipProps={{
          content: ({ label, payload }) => (
            <ChartTooltip label={label} payload={payload} highTides={highTides} />
          ),
        }}
        unit="m"
        connectNulls={false}
        series={[{ name: "Height", color: "indigo.6" }]}
        curveType="natural"
        dotProps={{ r: 0 }}
        strokeWidth={2}
        activeDotProps={{ r: 8, strokeWidth: 1, fill: "#fff" }}
        referenceLines={[
          ...(config.showMHWSMHWN ? [
            { y: 5.1, label: "MHWS", color: "red.6" },
            { y: 3.4, label: "MHWN", color: "red.6" },
          ] : []),
          ...(config.showMLWNMLWS ? [
            { y: 1.8, label: "MLWN", color: "red.6" },
            { y: 0.3, label: "MLWS", color: "red.6" },
          ] : []),
          ...(config.showHighTides ? highTides.flatMap((tide) => ({
            x: tide.timestamp,
            label: DateTime.fromMillis(tide.timestamp * 1000).setZone('Europe/London').toFormat("HH:mm"),
            color: 'var(--hightide-line-color)',
          })) : []),
          ...(config.showSunriseSunset ? [
            { x: sunrise, label: "Sunrise", color: 'var(--sunrisesunset-line-color)' },
            { x: sunset, label: "Sunset", color: 'var(--sunrisesunset-line-color)' }
          ] : []),
          ...(config.toolMode !== 'none' ? [
            { y: effectiveTargetHeight, label: `${effectiveTargetHeight.toFixed(2)}m`, color: 'var(--mantine-color-blue-6)' },
            ...resultTimes.map(r => ({
              x: r.time,
              label: DateTime.fromMillis(r.time * 1000).setZone('Europe/London').toFormat("HH:mm"),
              color: 'var(--mantine-color-blue-6)',
            }))
          ] : []),
        ]}
      />
      <Paper shadow="xl" withBorder p="md" mb="xl" mt="md">
        <Stack gap="md">
          <Divider label="Tide Height & Port Entry Tools" labelPosition="center" />

          <SegmentedControl
            orientation={isMobile ? "vertical" : "horizontal"}
            value={config.toolMode}
            onChange={(value) => setConfig({ toolMode: value as any })}
            data={[
              { label: 'None', value: 'none' },
              {
                label: (
                  <Center>
                    <Group gap="xs">
                      <IconLineHeight size={16} />
                      <span>Find times for a target height</span>
                    </Group>
                  </Center>
                ),
                value: 'height'
              },
              {
                label: (
                  <Center>
                    <Group gap="xs">
                      <IconClock size={16} />
                      <span>Find other times with the same height as a target time</span>
                    </Group>
                  </Center>
                ),
                value: 'time'
              },
            ]}
          />

          {config.toolMode === 'height' && (
            <NumberInput
              label="Target Tide Height"
              value={config.targetHeight}
              onChange={(val) => setConfig({ targetHeight: Number(val) })}
              min={0}
              max={7}
              step={0.1}
              decimalScale={2}
              suffix="m"
            />
          )}

          {config.toolMode === 'time' && (
            <TimePicker
              label="Target Time"
              withDropdown
              value={config.targetTime ? `${config.targetTime.substring(0, 2)}:${config.targetTime.substring(2, 4)}` : undefined}
              onChange={(val) => setConfig({
                targetTime: val ? val.replace(':', '') : null
              })}
            />
          )}

          {config.toolMode !== 'none' && resultTimes.length > 0 && (
            <Box>
              <Text fw={500} size="sm" mb={4}>Estimated times that tide will be {effectiveTargetHeight.toFixed(2)}m high:</Text>
              <Group gap="xs">
                {resultTimes.map(r => (
                  <Paper key={r.time} withBorder px="xs" py={2} radius="sm" bg="blue.0">
                    <Group gap={4}>
                      {r.direction === 'rising' && <IconArrowUp size={14} color="var(--mantine-color-blue-9)" />}
                      {r.direction === 'falling' && <IconArrowDown size={14} color="var(--mantine-color-blue-9)" />}
                      {r.direction === 'flat' && <IconMinus size={14} color="var(--mantine-color-blue-9)" />}
                      <Text size="sm" fw={700} c="blue.9">
                        {DateTime.fromMillis(r.time * 1000).setZone('Europe/London').toFormat("HH:mm")}
                      </Text>
                      <Text size="xs" c="blue.7" fw={500} style={{ textTransform: 'capitalize' }}>
                        {r.direction === 'flat' ? 'peak/trough' : r.direction}
                      </Text>
                    </Group>
                  </Paper>
                ))}
              </Group>
            </Box>
          )}

          <Divider label="Chart Settings" labelPosition="center" />

          <Stack gap="xs">
            <Switch
              onLabel="SHOW" offLabel="HIDE"
              checked={config.showSunriseSunset}
              onChange={(event) => setConfig({ showSunriseSunset: event.currentTarget.checked })}
              label="Sunrise/Sunset Times"
              size="md"
            />
            <Switch
              onLabel="SHOW" offLabel="HIDE"
              checked={config.showHighTides}
              onChange={(event) => setConfig({ showHighTides: event.currentTarget.checked })}
              label="High Tides"
              size="md"
            />
            <Switch
              onLabel="SHOW" offLabel="HIDE"
              checked={config.showMHWSMHWN}
              onChange={(event) => setConfig({ showMHWSMHWN: event.currentTarget.checked })}
              label="Mean High Water Springs (MHWS) and Mean High Water Neaps (MHWN)"
              size="md"
            />
            <Switch
              onLabel="SHOW" offLabel="HIDE"
              checked={config.showMLWNMLWS}
              onChange={(event) => setConfig({ showMLWNMLWS: event.currentTarget.checked })}
              label="Mean Low Water Neaps (MLWN) and Mean Low Water Springs (MLWS)"
              size="md"
            />
          </Stack>
        </Stack>
      </Paper>
    </>
  );
}
