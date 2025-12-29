import React from 'react';
import { useAuth } from './context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
 
    return <div>

        <p>hello {user.name}</p>
    </div>
}