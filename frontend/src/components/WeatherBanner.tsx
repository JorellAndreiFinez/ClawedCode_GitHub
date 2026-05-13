import { useEffect, useState } from "react";

type WeatherState = "sunny" | "rainy" | "cloudy" | null;

const WEATHER_CONFIG = {
  sunny: { icon: "☀️", message: "Good time to go", sub: "Clear skies today", bg: "bg-yellow-50 border-yellow-200 text-yellow-800" },
  rainy: { icon: "🌧️", message: "Expect delays", sub: "Heavy traffic possible due to rain", bg: "bg-blue-50 border-blue-200 text-blue-800" },
  cloudy: { icon: "🌥️", message: "Mild conditions", sub: "Overcast but manageable", bg: "bg-gray-50 border-gray-200 text-gray-700" },
};

function mapWeather(id: number): WeatherState {
  if (id >= 200 && id < 600) return "rainy";
  if (id >= 600 && id < 700) return "rainy";
  if (id >= 700 && id < 800) return "cloudy";
  if (id === 800) return "sunny";
  return "cloudy";
}

export default function WeatherBanner({ city = "Manila" }: { city?: string }) {
  const [weather, setWeather] = useState<WeatherState>(null);
  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;

  useEffect(() => {
    if (!apiKey) return;

    fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.weather?.[0]?.id) {
          setWeather(mapWeather(data.weather[0].id));
        }
      })
      .catch(() => {});
  }, [apiKey, city]);

  if (!weather || !apiKey) return null;

  const config = WEATHER_CONFIG[weather];

  return (
    <div className={`border rounded-xl px-4 py-3 flex items-center gap-3 mb-4 ${config.bg}`}>
      <span className="text-2xl">{config.icon}</span>
      <div>
        <p className="font-semibold text-sm">{config.message}</p>
        <p className="text-xs opacity-75">{config.sub}</p>
      </div>
    </div>
  );
}
