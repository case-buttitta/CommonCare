import React, { useState } from 'react';
import { applyTheme } from '../utils/theme';

const ThemeSettings = () => {
  const [colors, setColors] = useState({
    primary_color: '#3b82f6',
    secondary_color: '#1e40af'
  });

  const handleSave = async () => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/themes`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}` // Assuming JWT storage
      },
      body: JSON.stringify(colors),
    });

    if (response.ok) {
      const data = await response.json();
      applyTheme(data.theme); // Apply immediately!
      alert("Theme saved for your location!");
    }
  };

  return (
    <div className="p-4 border rounded shadow">
      <h3>Location Theme Customization</h3>
      <label>Primary Color: </label>
      <input 
        type="color" 
        value={colors.primary_color} 
        onChange={(e) => setColors({...colors, primary_color: e.target.value})} 
      />
      <br />
      <label>Secondary Color: </label>
      <input 
        type="color" 
        value={colors.secondary_color} 
        onChange={(e) => setColors({...colors, secondary_color: e.target.value})} 
      />
      <button onClick={handleSave}>Save Theme</button>
    </div>
  );
};

export default ThemeSettings;