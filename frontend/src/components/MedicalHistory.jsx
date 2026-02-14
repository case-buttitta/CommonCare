import { useState, useEffect } from 'react';

const MedicalHistory = ({ patientId, userType }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        condition: '',
        diagnosis_date: '',
        status: 'Active',
        notes: ''
    });

    useEffect(() => {
        fetchHistory();
    }, [patientId]);

    const fetchHistory = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/patients/${patientId}/history`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch medical history');

            const data = await response.json();
            setHistory(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const token = localStorage.getItem('token');
            const url = editingId
                ? `/api/history/${editingId}`
                : `/api/patients/${patientId}/history`;

            const method = editingId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) throw new Error('Failed to save record');

            await fetchHistory();
            setShowForm(false);
            resetForm();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this record?')) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/history/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to delete record');

            fetchHistory();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleEdit = (record) => {
        setFormData({
            condition: record.condition,
            diagnosis_date: record.diagnosis_date || '',
            status: record.status,
            notes: record.notes || ''
        });
        setEditingId(record.id);
        setShowForm(true);
    };

    const resetForm = () => {
        setFormData({
            condition: '',
            diagnosis_date: '',
            status: 'Active',
            notes: ''
        });
        setEditingId(null);
    };

    if (loading) return <div>Loading history...</div>;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Medical History</h2>
                {userType === 'staff' && !showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                        Add Condition
                    </button>
                )}
            </div>

            {error && <div className="text-red-500 mb-4 text-sm">{error}</div>}

            {showForm && (
                <form onSubmit={handleSubmit} className="mb-6 bg-gray-50 p-4 rounded border">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                            <input
                                type="text"
                                required
                                className="w-full p-2 border rounded"
                                value={formData.condition}
                                onChange={e => setFormData({ ...formData, condition: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis Date</label>
                            <input
                                type="text"
                                className="w-full p-2 border rounded"
                                placeholder="YYYY-MM-DD or 'Childhood'"
                                value={formData.diagnosis_date}
                                onChange={e => setFormData({ ...formData, diagnosis_date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                className="w-full p-2 border rounded"
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option value="Active">Active</option>
                                <option value="Managed">Managed</option>
                                <option value="Resolved">Resolved</option>
                            </select>
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea
                            className="w-full p-2 border rounded"
                            rows="2"
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => { setShowForm(false); resetForm(); }}
                            className="px-3 py-1 text-gray-600 hover:text-gray-800"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            {editingId ? 'Update' : 'Save'}
                        </button>
                    </div>
                </form>
            )}

            {history.length === 0 ? (
                <p className="text-gray-500 italic">No medical history recorded.</p>
            ) : (
                <div className="space-y-3">
                    {history.map(record => (
                        <div key={record.id} className="border-b pb-3 last:border-0 last:pb-0">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-medium text-gray-900">{record.condition}</h3>
                                    <p className="text-sm text-gray-500">
                                        Diagnosed: {record.diagnosis_date || 'N/A'} • Status:
                                        <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${record.status === 'Active' ? 'bg-red-100 text-red-800' :
                                                record.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                                                    'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {record.status}
                                        </span>
                                    </p>
                                    {record.notes && (
                                        <p className="text-sm text-gray-600 mt-1">{record.notes}</p>
                                    )}
                                </div>

                                {userType === 'staff' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEdit(record)}
                                            className="text-blue-600 hover:text-blue-800 text-sm"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(record.id)}
                                            className="text-red-600 hover:text-red-800 text-sm"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MedicalHistory;
