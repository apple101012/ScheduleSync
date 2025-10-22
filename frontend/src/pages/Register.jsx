import React from 'react';

function Register() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded shadow">
        <h2 className="mb-6 text-2xl font-bold text-center">Register</h2>
        {/* Registration form will go here */}
        <form>
          <input className="w-full mb-4 p-2 border rounded" type="text" placeholder="Username" />
          <input className="w-full mb-4 p-2 border rounded" type="email" placeholder="Email" />
          <input className="w-full mb-4 p-2 border rounded" type="password" placeholder="Password" />
          <button className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700" type="submit">Register</button>
        </form>
      </div>
    </div>
  );
}

export default Register;
