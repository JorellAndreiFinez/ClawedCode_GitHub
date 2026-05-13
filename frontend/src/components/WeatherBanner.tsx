import { useEffect, useState } from "react";
import { Cloud, CloudRain, SunMedium } from "lucide-react";

type WeatherState = "sunny" | "rainy" | "cloudy";
type WeatherSnapshot = {
  state: WeatherState;
  temperature: number | null;
  location: string;
};

const WEATHER_CONFIG = {
  sunny: {
    Icon: SunMedium,
    label: "Sunny",
    message: "Good time to go",
    sub: "Clear weather should make travel easier.",
    tone: "border-[#39b580] bg-[#83f9be]/35 text-[#004029]",
  },
  rainy: {
    Icon: CloudRain,
    label: "Rainy",
    message: "Expect delays",
    sub: "Rain may slow down trips to the queue.",
    tone: "border-[#fe7952] bg-[#ffdbd1] text-[#862201]",
  },
  cloudy: {
    Icon: Cloud,
    label: "Cloudy",
    message: "Neutral condition",
    sub: "Weather is not a major travel factor.",
    tone: "border-[#bccabf] bg-[#f5f3f3] text-[#303031]",
  },
} satisfies Record<
  WeatherState,
  {
    Icon: typeof SunMedium;
    label: string;
    message: string;
    sub: string;
    tone: string;
  }
>;

function mapOpenWeather(id: number): WeatherState {
  if (id >= 200 && id < 700) return "rainy";
  if (id >= 700 && id < 800) return "cloudy";
  if (id === 800) return "sunny";
  return "cloudy";
}

function mapOpenMeteo(code: number): WeatherState {
  if ([0, 1].includes(code)) return "sunny";
  if ([2, 3, 45, 48].includes(code)) return "cloudy";
  return "rainy";
}

export default function WeatherBanner({ city = "Manila" }: { city?: string }) {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;

  useEffect(() => {
    const controller = new AbortController();

    async function loadWeather() {
      try {
        if (apiKey) {
          const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
              city
            )}&appid=${apiKey}&units=metric`,
            { signal: controller.signal }
          );
          const data = await response.json();

          if (data.weather?.[0]?.id) {
            setWeather({
              state: mapOpenWeather(data.weather[0].id),
              temperature:
                typeof data.main?.temp === "number"
                  ? Math.round(data.main.temp)
                  : null,
              location: data.name || city,
            });
            return;
          }
        }

        const geocode = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            city
          )}&count=1&language=en&format=json`,
          { signal: controller.signal }
        );
        const geocodeData = await geocode.json();
        const place = geocodeData.results?.[0];

        if (!place) return;

        const forecast = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code`,
          { signal: controller.signal }
        );
        const forecastData = await forecast.json();

        setWeather({
          state: mapOpenMeteo(forecastData.current?.weather_code ?? 3),
          temperature:
            typeof forecastData.current?.temperature_2m === "number"
              ? Math.round(forecastData.current.temperature_2m)
              : null,
          location: place.name || city,
        });
      } catch {
        if (!controller.signal.aborted) setWeather(null);
      }
    }

    loadWeather();

    return () => controller.abort();
  }, [apiKey, city]);

  if (!weather) return null;

  const config = WEATHER_CONFIG[weather.state];
  const temperature =
    weather.temperature === null ? null : `${weather.temperature} C`;

  return (
    <section className="rounded-2xl border border-[#e3e2e2] bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-[#6d7a71]">
            Travel context
          </p>
          <p className="mt-1 text-sm font-medium text-[#3d4a42]">
            Weather only helps decide when to go
          </p>
        </div>
        <div
          className={`flex size-12 items-center justify-center rounded-xl border ${config.tone}`}
        >
          <config.Icon className="size-6" />
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${config.tone}`}>
              {config.label}
            </span>
            {temperature && (
              <span className="text-xs font-bold uppercase text-[#6d7a71]">
                {temperature}
              </span>
            )}
          </div>
          <p className="text-3xl font-extrabold text-[#1b1c1c]">
            {config.message}
          </p>
          <p className="mt-2 max-w-md text-sm font-medium leading-5 text-[#3d4a42]">
            {weather.location} - {config.sub}
          </p>
        </div>
      </div>
    </section>
  );
}
