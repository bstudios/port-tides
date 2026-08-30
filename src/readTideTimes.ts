import { createServerFn } from '@tanstack/react-start';
//import { readFileSync } from "node:fs";
import { notFound, redirect } from '@tanstack/react-router';
import { DateTime } from "luxon";
import tidalDataFromFile from '../data/tides.json';
import { findNextHighTide } from './nextHighTide';
import type { TidesJson_TopLevel } from './types';

//const TIDES_FILE = 'data/tides.json'

const TidalData = () => {
  //const tides = readFileSync(TIDES_FILE, "utf8");
  //return JSON.parse(tides) as TidesJson_TopLevel
  return tidalDataFromFile as TidesJson_TopLevel
}

export const getPDFs = createServerFn({ method: 'GET' }).handler(async () => {
  return TidalData().pdfs;
})

export const getTidesForMonth = createServerFn({ method: 'GET' })
  .inputValidator((d: { url: string }) => d)
  .handler(async ({ data }) => {
    const { url } = data;
    const tidalData = TidalData();

    const pdf = tidalData.pdfs.find((p) => p.url === url);

    if (!pdf) {
      // Check for dashed version of the date in the URL (ie 2025-12 instead of 2025/12)
      const pdfByDashed = tidalData.pdfs.find((p) => p.url.replace(/\//g, "-") === url);
      if (pdfByDashed) {
        throw redirect({
          to: "/tide-tables/$",
          params: { _splat: pdfByDashed.url },
          statusCode: 301
        });
      }
      throw notFound();
    }

    const firstDayOfMonth = pdf.date;
    const monthMatch =
      firstDayOfMonth.split("-")[0] + "-" + firstDayOfMonth.split("-")[1];
    const tides = tidalData.schedule.filter((date) => {
      return date.date.startsWith(monthMatch);
    });

    return { tides, pdf };
  });

export const getTidesForGraph = createServerFn({ method: 'GET' })
  .inputValidator((d: { date: string }) => d)
  .handler(async ({ data }) => {
    const { date } = data;
    const tides = TidalData();

    const index = tides.schedule.findIndex((d) => d.date === date);

    if (index === -1) {
      throw notFound();
    }

    // Work out day before and day of etc

    const day = tides.schedule[index];
    const nextDay: string | false =
      index < tides.schedule.length - 1
        ? tides.schedule[index + 1].date
        : false;
    const previousDay: string | false = index > 0 ? tides.schedule[index - 1].date : false;

    // Find the data for the graph itself
    const graphStart = DateTime.fromSQL(day.date, { zone: 'Europe/London' }).startOf('day');
    const graphStartTimestamp = graphStart.toJSDate();
    const graphEndTimestamp = graphStart.plus({ days: 1 }).toJSDate();

    let startIndex = tides.schedule.findIndex(
      (date) => {
        return new Date(date.date) >= graphStartTimestamp;
      }
    );
    let endIndex = tides.schedule.findIndex(
      (date) => {
        return new Date(date.date) >= graphEndTimestamp;
      }
    );

    // Adjust indices to include the days immediately before and after the range to capture them in the graph
    startIndex = startIndex > 0 ? startIndex - 1 : startIndex;
    endIndex = endIndex < tides.schedule.length ? endIndex + 1 : endIndex;

    // Slice the array to get the desired elements
    const highTides = tides.schedule
      .slice(startIndex, endIndex)
      .flatMap((date) =>
        date.groups.map((tide) => ({
          timestamp: DateTime.fromSQL(date.date + " " + tide.time, { zone: 'Europe/London' }).toMillis() / 1000,
          height: Number(tide.height),
        }))
      );

    return { day, nextDay, previousDay, highTides, graphStartTimestamp, graphEndTimestamp };
  });

export const getHomepageTides = createServerFn({ method: 'GET' }).inputValidator((d: { daysToDisplay: number }) => d)
  .handler(async ({ data }) => {
    const { daysToDisplay } = data;
    if (daysToDisplay < 1 || daysToDisplay > 10) {
      throw notFound();
    }
    const today = DateTime.now().setZone('Europe/London').startOf('day').toJSDate();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + daysToDisplay);

    const tidalData = TidalData();
    const homepageTides = tidalData.schedule.filter(
      (tideDay) => {
        let date = new Date(tideDay.date);
        return date >= today && date <= nextWeek;
      }
    );

    const month = DateTime.now().setZone('Europe/London').startOf('month').toJSDate();
    const nextYear = new Date(month);
    nextYear.setFullYear(month.getFullYear() + 1);
    const homepageFiles = tidalData.pdfs.filter((pdf) => {
      let date = new Date(pdf.date);
      return date < nextYear && date >= month;
    });
    // Get the next high tide. The browser recomputes this with the same helper
    // once the page has been open (or edge-cached) long enough to drift.
    const nextHighTide = findNextHighTide(homepageTides);

    return { homepageTides, today, homepageFiles, nextHighTide };
  })


export const getSitemapTides = createServerFn({ method: 'GET' }).handler(async () => {
  return TidalData();
})

export const getTideTablesByYear = createServerFn({ method: 'GET' }).handler(async () => {
  const month = DateTime.now().setZone('Europe/London').startOf('month').toJSDate();
  const nextYear = new Date(month);
  nextYear.setFullYear(month.getFullYear() + 1);

  const tidalData = TidalData();

  const files = tidalData.pdfs.filter((pdf) => {
    let date = new Date(pdf.date);
    return date < nextYear;
  });
  const years = [
    ...new Set(
      files.map((month) => {
        return new Date(month.date).getFullYear();
      })
    ),
  ]
    .map((year) => {
      return {
        year: year as number,
        months: files.filter((month) => {
          return year == new Date(month.date).getFullYear();
        }).map((month) => {
          return {
            name: month.name,
            url: month.url,
          };
        }),
      };
    })
    .reverse();

  return { years, month };
})

