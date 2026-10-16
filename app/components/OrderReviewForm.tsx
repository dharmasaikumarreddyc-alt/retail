'use client';

import { useState } from 'react';
import { backendUrl } from '../lib/backend';
import { getAuthenticatedSession } from '../lib/auth';

export default function OrderReviewForm({ orderId }: { orderId: string }) {
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const session = await getAuthenticatedSession('customer');
      if (!session) throw new Error('Sign in with your customer account to submit a review.');
      const response = await fetch(`${backendUrl}/payments/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ orderId, rating, review }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || data.error || 'Could not submit your review.');
      setMessage('Thanks! Your review is now visible to this merchant.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit your review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (message) return <div className="alert alert-success mb-0">{message}</div>;

  return (
    <form onSubmit={submitReview} className="card card-body mt-3">
      <h5 className="mb-2">Rate your food and share a review</h5>
      <label className="form-label" htmlFor={`review-rating-${orderId}`}>Rating</label>
      <select
        id={`review-rating-${orderId}`}
        className="form-select mb-3"
        value={rating}
        onChange={(event) => setRating(Number(event.target.value))}
      >
        {[5, 4, 3, 2, 1].map((value) => (
          <option key={value} value={value}>{value} star{value === 1 ? '' : 's'}</option>
        ))}
      </select>
      <label className="form-label" htmlFor={`review-text-${orderId}`}>Your review</label>
      <textarea
        id={`review-text-${orderId}`}
        className="form-control mb-3"
        rows={3}
        maxLength={2000}
        value={review}
        onChange={(event) => setReview(event.target.value)}
        placeholder="How was your order?"
      />
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <button type="submit" className="btn btn-outline-primary align-self-start" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit review'}
      </button>
    </form>
  );
}
