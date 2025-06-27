import React from 'react';

const EmailList = ({ emails }) => {
  if (emails.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-2">Scraped Emails</h2>
      <ul className="list-disc pl-5 space-y-2 max-h-96 overflow-y-auto">
        {emails.map((email, index) => (
          <li key={index} className="text-gray-700">{email}</li>
        ))}
      </ul>
    </div>
  );
};

export default EmailList;