import fs from "fs";
import ical from "ical-generator";
import { DateTime } from "luxon";
import TidalData from "../data/tides.json" with { type: "json" };

// Type definitions to match data structure
interface TidesJson_ScheduleObject {
  date: string;
  groups: Array<{
    time: string;
    height: string;
  }>;
  sunrise: string;
  sunset: string;
}

const generateIcal = () => {
  console.log(`Generating iCal file for tide times`);
  const cal = ical();
  // Deliberately not cal.timezone("Europe/London"): that switches event
  // serialisation to *floating* times (DTSTART:20260830T224900), which only
  // read correctly for a viewer already in that zone. Events are emitted as
  // absolute UTC instants instead, so they land on the right moment in every
  // client. This is only a display hint for the calendar as a whole.
  cal.x("X-WR-TIMEZONE", "Europe/London");
  cal.name("Porthmadog Tide Times");
  cal.description(
    "Tide times for Porthmadog, Borth-y-gest, Morfa Bychan and Black Rock Sands from Port-Tides.com"
  );
  
  // Window the schedule in Europe/London so which days get included doesn't
  // depend on the timezone of the machine running the build.
  const today = DateTime.now().setZone("Europe/London").startOf("day");
  const nextYear = today.plus({ days: 365 });
  
  // Cast TidalData to any or typed structure because direct import might be typed generic
  const schedule = (TidalData as any).schedule as TidesJson_ScheduleObject[];

  schedule
    .filter((timeDay) => {
      const date = DateTime.fromSQL(timeDay.date, { zone: "Europe/London" });
      return date >= today && date <= nextYear;
    })
    .forEach((day) =>
      day.groups.forEach((tide) => {
        // Stored times are already Europe/London wall-clock, so parse them in
        // that zone rather than in the build machine's zone. toJSDate() then
        // yields the correct absolute instant regardless of where this runs.
        const start = DateTime.fromSQL(day.date + " " + tide.time, {
          zone: "Europe/London",
        });
        cal.createEvent({
          start: start.toJSDate(),
          end: start.plus({ minutes: 30 }).toJSDate(),
          summary: `High Tide Porthmadog - ${tide.height}m`,
          description: {
            plain: "Powered by port-tides.com",
            html: `More details at <a href="https://port-tides.com/">port-tides.com</a>`,
          },
          //  Commented out to reduce file size
          /*location: {
            title: "Porthmadog",
            address: "Harbwr Porthmadog, LL49 9AY, UK",
          },
          busystatus: ICalEventBusyStatus.FREE, // If ICalEventBusyStatus import needed, add it or use string
          class: ICalEventClass.PUBLIC,
          url: "https://port-tides.com/tide-tables",*/
        });
      })
    );
    
  // Ensure public dir exists
  if (!fs.existsSync("public")) {
      fs.mkdirSync("public");
  }
  
  fs.writeFileSync("public/porthmadog-tides.ical", cal.toString());
  console.log(
    `Generated iCal file for tide times at public/porthmadog-tides.ical`
  );
};

generateIcal();
