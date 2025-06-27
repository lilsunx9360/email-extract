import React from 'react';

const Message = ({ type, message }) => {
  if (!message) return null;

  const isError = type === 'error';
  return (
    <div
      className={`mt-4 p-3 rounded-md ${
        isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
      }`}
    >
      {message}
    </div>
  );
};

export default Message;