import { useEffect, useState } from "react";

type WeatherState = "sunny" | "rainy" | "cloudy";
type WeatherSnapshot = {
  state: WeatherState;
  temperature: number | null;
  location: string;
};

const WEATHER_CONFIG: Record<
  WeatherState,
  { label: string; message: string; sub: string; bg: string }
> = {
  sunny: {
    label: "Sunny",
    message: "Good time to go",
    sub: "Clear weather should make travel easier.",
    bg: "bg-yellow-50 border-yellow-200 text-yellow-800",
  },
  rainy: {
    label: "Rainy",
    message: "Expect delays / harder travel",
    sub: "Rain may slow down trips to the queue.",
    bg: "bg-blue-50 border-blue-200 text-blue-800",
  },
  cloudy: {
    label: "Cloudy",
    message: "Neutral condition",
    sub: "Weather is not a major travel factor.",
    bg: "bg-gray-50 border-gray-200 text-gray-700",
  },
};

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
    weather.temperature === null ? "" : ` - ${weather.temperature} C`;

  return (
    <div
      className={`border rounded-xl px-4 py-3 flex items-center gap-3 mb-4 ${config.bg}`}
    >
      <span className="text-xs font-bold uppercase tracking-wide">
        {config.label}
      </span>
      <div>
        <p className="font-semibold text-sm">{config.message}</p>
        <p className="text-xs opacity-75">
          {weather.location}
          {temperature} - {config.sub}
        </p>
      </div>
    </div>
  );
}
