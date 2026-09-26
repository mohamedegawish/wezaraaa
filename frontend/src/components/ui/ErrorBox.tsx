import React from 'react';

export const ErrorBox: React.FC<{ message: React.ReactNode; style?: React.CSSProperties }> = ({ message, style }) => {
  if (!message) return null;
  return <div className="error-box" style={style}>{message}</div>;
};
