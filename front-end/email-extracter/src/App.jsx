
import React, { useState } from 'react';
import axios from 'axios';
import FileUpload from './FileUpload';
import Button from './Button';
import Message from './Message';
import EmailList from './EmailList';
import './App.css';

const App = () => {
  const [file, setFile] = useState(null);
  const [emails, setEmails] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError('');
    setSuccess('');
    setEmails([]);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select an Excel file');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:5000/scrape-emails', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.status === 200) {
        if (response.data.emails && response.data.emails.length > 0) {
          setEmails(response.data.emails);
          setSuccess('Emails scraped successfully!');
        } else {
          setSuccess('No valid emails found.');
        }
      } else {
        setError(response.data.error || 'Failed to scrape emails');
      }
    } catch (err) {
      setError('Error connecting to the server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl w-full mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Email Scraper</h1>
      <FileUpload onFileChange={handleFileChange} />
      <Button onClick={handleUpload} loading={loading}>
        Scrape Emails
      </Button>
      <Message type="error" message={error} />
      <Message type="success" message={success} />
      <EmailList emails={emails} />
      {console.log(emails)}
    </div>
  );
};

export default App;