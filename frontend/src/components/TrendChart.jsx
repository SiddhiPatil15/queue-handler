import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const COUNTER_COLORS = {
  c1: "#1E40AF", // Deep Navy Blue
  c2: "#0D9488", // Operational Teal
  c3: "#D97706", // Saffron / Orange Accent
  c4: "#6D28D9", // Deep Violet
  c5: "#059669", // Dark Emerald
  c6: "#DC2626", // Signal Red
};

export default function TrendChart({ snapshot, predictions, selectedModel, selectedHorizon }) {
  if (!snapshot || !snapshot.counters) return null;

  const predMap = Object.fromEntries((predictions || []).map((p) => [p.id, p]));
  const datasets = [];

  snapshot.counters.forEach((c) => {
    if (!c.active) return;
    const color = COUNTER_COLORS[c.id] || "#1E40AF";
    const history = c.history || [];
    if (!history.length) return;

    const lastPoint = history[history.length - 1];
    const forecastMinute = lastPoint[0] + selectedHorizon;
    const predObj = predMap[c.id] || {};
    const predictedVal = predObj.predicted_people ?? lastPoint[1];
    const lowerVal = predObj.lower_bound ?? predictedVal;
    const upperVal = predObj.upper_bound ?? predictedVal;

    // 1. Historical Actual Line
    datasets.push({
      label: c.name,
      data: history.map(([x, y]) => ({ x, y })),
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.2,
    });

    // 2. Forecast Trend Line (Dashed)
    datasets.push({
      label: `${c.name} (forecast)`,
      data: [
        { x: lastPoint[0], y: lastPoint[1] },
        { x: forecastMinute, y: predictedVal },
      ],
      borderColor: color,
      borderWidth: 2,
      borderDash: [5, 4],
      pointRadius: [0, 4],
      pointBackgroundColor: color,
      tension: 0,
      showLine: true,
    });

    // 3. Confidence Interval (Linear Model)
    if (selectedModel === "linear" && lowerVal !== upperVal) {
      datasets.push({
        label: `${c.name} (confidence)`,
        data: [
          { x: forecastMinute, y: lowerVal },
          { x: forecastMinute, y: upperVal },
        ],
        borderColor: "transparent",
        backgroundColor: color + "14",
        fill: false,
        pointRadius: 0,
      });
    }
  });

  const data = { datasets };

  const options = {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "nearest", intersect: false },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          color: "#334155",
          font: { family: "'IBM Plex Sans', sans-serif", size: 12, weight: 600 },
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 14,
          filter: (item) =>
            !item.text.includes("(forecast)") && !item.text.includes("(confidence)"),
          boxWidth: 8,
          boxHeight: 8,
        },
      },
      tooltip: {
        backgroundColor: "#0f172a",
        titleColor: "#ffffff",
        bodyColor: "#f8fafc",
        borderColor: "#334155",
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        usePointStyle: true,
        titleFont: { family: "'IBM Plex Mono', monospace", size: 12, weight: 600 },
        bodyFont: { family: "'IBM Plex Sans', sans-serif", size: 12 },
        displayColors: true,
      },
    },
    scales: {
      x: {
        type: "linear",
        title: { display: true, text: "Simulated Time (Minutes)", color: "#475569", font: { family: "'IBM Plex Sans', sans-serif", size: 11, weight: 600 } },
        grid: { color: "#E2E8F0" },
        ticks: { color: "#475569", font: { family: "'IBM Plex Mono', monospace", size: 10 } },
        border: { dash: [2, 2], color: "#CBD5E1" }
      },
      y: {
        title: { display: true, text: "People Waiting", color: "#475569", font: { family: "'IBM Plex Sans', sans-serif", size: 11, weight: 600 } },
        grid: { color: "#E2E8F0" },
        ticks: { color: "#475569", font: { family: "'IBM Plex Mono', monospace", size: 10 } },
        beginAtZero: true,
        border: { dash: [2, 2], color: "#CBD5E1" }
      },
    },
  };

  return (
    <div style={{ height: "300px", position: "relative" }}>
      <Line data={data} options={options} />
    </div>
  );
}
