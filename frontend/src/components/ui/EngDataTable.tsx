import React, { ReactNode } from 'react';

interface EngDataTableProps {
  headers: string[];
  rows: ReactNode[][];
  className?: string;
}

export const EngDataTable: React.FC<EngDataTableProps> = ({ headers, rows, className = '' }) => (
  <table className={`eng-table ${className}`}>
    <thead>
      <tr>
        {headers.map((h, i) => (
          <th key={i}>{h}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, ri) => (
        <tr key={ri}>
          {row.map((cell, ci) => (
            <td key={ci}>{cell}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);
