import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './BiomarkerChart.css';

const BiomarkerChart = ({ data, type, unit }) => {
    if (!data || data.length === 0) {
        return (
            <div className="chart-empty">
                No trend data available.
            </div>
        );
    }

    const sortedData = [...data].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
    );

    return (
        <div className="biomarker-chart">
            <h3 className="chart-title">
                {type.replace(/_/g, ' ')} Trend
            </h3>

            <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={sortedData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(date) =>
                                new Date(date).toLocaleDateString()
                            }
                        />
                        <YAxis
                            label={{
                                value: unit,
                                angle: -90,
                                position: 'insideLeft'
                            }}
                        />
                        <Tooltip
                            labelFormatter={(date) =>
                                new Date(date).toLocaleDateString()
                            }
                            formatter={(value) => [`${value} ${unit}`, 'Value']}
                        />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#8884d8"
                            activeDot={{ r: 8 }}
                            name={type.replace(/_/g, ' ')}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default BiomarkerChart;
