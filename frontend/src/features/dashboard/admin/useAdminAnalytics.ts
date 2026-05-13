import { useEffect, useState } from "react";

export function useAdminAnalytics(queue: any) {
  const [stats, setStats] = useState({
    activeStations: 0,
    waiting: 0,
    served: 0,
    noShow: 0,
  });

  useEffect(() => {
    if (!queue) return;

    const stations = queue.stations || {};
    const users = queue.users || {};
    const analytics = queue.analytics || {};
    const queueState = queue.queue_state || {};

    setStats({
      activeStations: Object.values(stations).filter(
        (s: any) => s.status === "active",
      ).length,

      waiting: queueState.total_waiting || Object.values(users).length,

      served: analytics.total_served || 0,

      noShow: analytics.total_no_show || 0,
    });
  }, [queue]);

  return stats;
}
