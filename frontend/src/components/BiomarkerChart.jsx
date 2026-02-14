import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BiomarkerChart = ({ data, type, unit }) => {
    if (!data || data.length === 0) {
        return <div className="p-4 text-gray-500 italic">No trend data available.</div>;
    }

    // Sort data by date just in case
    const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
            <h3 className="text-lg font-medium text-gray-700 mb-4 capitalize">
                {type.replace(/_/g, ' ')} Trend
            </h3>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={sortedData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(date) => new Date(date).toLocaleDateString()}
                        />
                        <YAxis label={{ value: unit, angle: -90, position: 'insideLeft' }} />
                        <Tooltip
                            labelFormatter={(date) => new Date(date).toLocaleDateString()}
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
