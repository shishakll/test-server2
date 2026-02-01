import React from 'react';
import type { VulnerabilitySummary } from '@types';

interface SeverityChartProps {
  summary: VulnerabilitySummary;
  className?: string;
}

/**
 * SeverityChart - Horizontal bar chart showing vulnerability severity distribution
 */
export const SeverityChart: React.FC<SeverityChartProps> = ({ summary, className }) => {
  const maxCount = Math.max(
    summary.critical,
    summary.high,
    summary.medium,
    summary.low,
    summary.informational,
    1
  );

  const total = summary.total || 1;

  const items = [
    { key: 'critical', label: 'Critical', count: summary.critical, color: '#ef4444' },
    { key: 'high', label: 'High', count: summary.high, color: '#f97316' },
    { key: 'medium', label: 'Medium', count: summary.medium, color: '#eab308' },
    { key: 'low', label: 'Low', count: summary.low, color: '#22c55e' },
    { key: 'informational', label: 'Info', count: summary.informational, color: '#9ca3af' },
  ];

  return (
    <div className={`severity-chart ${className || ''}`}>
      {items.map((item) => {
        const width = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
        const percent = ((item.count / total) * 100).toFixed(1);

        return (
          <div key={item.key} className="severity-bar">
            <span className="severity-label" style={{ color: item.color }}>
              {item.label}
            </span>
            <div className="severity-track">
              <div
                className={`severity-fill ${item.key}`}
                style={{ width: `${width}%` }}
              >
                {item.count > 0 && (
                  <span className="severity-count">{item.count}</span>
                )}
              </div>
            </div>
            <span className="severity-percent">{percent}%</span>
          </div>
        );
      })}
    </div>
  );
};

/**
 * DonutChart - Circular chart for vulnerability distribution
 */
interface DonutChartProps {
  summary: VulnerabilitySummary;
  size?: number;
  strokeWidth?: number;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  summary,
  size = 160,
  strokeWidth = 20,
}) => {
  const total = summary.total || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const items = [
    { key: 'critical', count: summary.critical, color: '#ef4444' },
    { key: 'high', count: summary.high, color: '#f97316' },
    { key: 'medium', count: summary.medium, color: '#eab308' },
    { key: 'low', count: summary.low, color: '#22c55e' },
    { key: 'informational', count: summary.informational, color: '#9ca3af' },
  ];

  let offset = 0;

  const segments = items.map((item) => {
    const percent = item.count / total;
    const length = percent * circumference;
    const segment = {
      color: item.color,
      offset,
      length,
      percent: (percent * 100).toFixed(1),
      count: item.count,
    };
    offset += length;
    return segment;
  });

  return (
    <div className="donut-chart-container">
      <div className="donut-chart">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth={strokeWidth}
          />
          {segments.map((segment, index) => {
            if (segment.length === 0) return null;
            return (
              <circle
                key={index}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${segment.length} ${circumference}`}
                strokeDashoffset={-segment.offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
          })}
        </svg>
        <div className="donut-center">
          <span className="donut-total">{total}</span>
          <span className="donut-label">Total</span>
        </div>
      </div>
      <div className="donut-legend">
        {items.map((item) => {
          if (item.count === 0) return null;
          return (
            <div key={item.key} className="legend-item">
              <span className={`legend-dot ${item.key}`} />
              <span>{item.label}</span>
              <span style={{ marginLeft: 'auto', color: '#8b8b9e' }}>
                {item.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * TrendLineChart - Simple line chart for showing trends over time
 */
interface TrendLineProps {
  data: number[];
  labels?: string[];
  height?: number;
  color?: string;
}

export const TrendLineChart: React.FC<TrendLineProps> = ({
  data,
  labels,
  height = 60,
  color = '#6366f1',
}) => {
  if (data.length === 0) return null;

  const max = Math.max(...data, 1);
  const width = 100;
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - (value / max) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
      />
      {data.map((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - (value / max) * height;
        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r="3"
            fill={color}
          />
        );
      })}
    </svg>
  );
};

export default SeverityChart;
