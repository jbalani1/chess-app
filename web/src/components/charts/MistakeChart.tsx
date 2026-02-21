'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface ChartDataItem {
  [key: string]: string | number | undefined
}

interface MistakeChartProps {
  data: ChartDataItem[]
  type: 'bar' | 'pie'
  title: string
  xKey: string
  yKey: string
}

const COLORS = ['#81B64C', '#F5A623', '#CA3431', '#8B5CF6', '#06B6D4', '#84CC16']

export default function MistakeChart({
  data,
  type,
  title,
  xKey,
  yKey
}: MistakeChartProps) {
  if (!data || data.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64 text-[var(--text-muted)]">
          No data available
        </div>
      </div>
    )
  }

  const renderBarChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
          angle={-45}
          textAnchor="end"
          height={80}
          axisLine={{ stroke: 'var(--border-color)' }}
          tickLine={{ stroke: 'var(--border-color)' }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
          axisLine={{ stroke: 'var(--border-color)' }}
          tickLine={{ stroke: 'var(--border-color)' }}
        />
        <Tooltip
          formatter={(value: number | string, name: string) => [
            `${value}${name === 'mistake_rate' ? '%' : ''}`,
            name === 'mistake_rate' ? 'Mistake Rate' : name
          ]}
          contentStyle={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-primary)'
          }}
          labelStyle={{ color: 'var(--text-primary)' }}
        />
        <Bar
          dataKey={yKey}
          fill="#81B64C"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )

  const renderPieChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey={yKey}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-primary)'
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )

  return (
    <div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{title}</h3>
      {type === 'bar' ? renderBarChart() : renderPieChart()}
    </div>
  )
}
