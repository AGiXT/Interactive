'use client';

import React, { useState, useEffect, ReactNode, useContext } from 'react';
import { LuLightbulb as LightBulbIcon } from 'react-icons/lu';
import { InteractiveConfigContext } from '@/components/interactive/InteractiveConfigContext';

interface Column {
  field: string;
  width: number;
  flex: number;
  headerName: string;
}

interface Row {
  id: string | number;
  [key: string]: string | number;
}

export const RendererXSV = ({
  xsvData,
  separator = ',',
  setLoading,
}: {
  xsvData: string[];
  separator?: RegExp | string;
  setLoading?: (loading: boolean) => void;
}): ReactNode => {
  const [open, setOpen] = useState(false);
  const [userMessage, setUserMessage] = useState('Surprise me!');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [filteredRows, setFilteredRows] = useState<Row[]>([]);
  const [filteredColumns, setFilteredColumns] = useState<Column[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [sortConfig, setSortConfig] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState<{ [key: string]: string }>({});

  const context = useContext(InteractiveConfigContext);

  useEffect(() => {
    if (!xsvData) {
      setError('No data provided.');
    } else {
      const rawData = xsvData.map((row) =>
        row
          .split(separator)
          .map((cell) => cell.trim().replaceAll('"', ''))
          .filter((cell) => cell),
      );

      if (
        !rawData.every((row) => row.length === rawData[0].length) ||
        !rawData[0] ||
        rawData.some((row) => [0, 1].includes(row.length))
      ) {
        setError('XSV data is not valid.');
      } else {
        setError('');

        // Process headers
        const headers = rawData[0];
        const hasIdColumn = headers[0].toLowerCase().includes('id');
        const dataColumns = hasIdColumn ? headers.slice(1) : headers;

        setColumns(
          dataColumns.map((header) => ({
            field: header,
            width: Math.max(160, header.length * 10),
            flex: 1,
            headerName: header,
          })),
        );

        // Process data rows
        const dataRows = rawData.slice(1);
        setRows(
          dataRows.map((row, index) => {
            const rowData = hasIdColumn
              ? {
                  id: row[0],
                  ...Object.fromEntries(dataColumns.map((header, i) => [header, row[i + 1] || ''])),
                }
              : {
                  id: index,
                  ...Object.fromEntries(dataColumns.map((header, i) => [header, row[i] || ''])),
                };
            return rowData;
          }),
        );
      }
    }
  }, [xsvData, separator]);

  useEffect(() => {
    setFilteredRows(rows);
  }, [rows]);

  useEffect(() => {
    setFilteredColumns(columns);
  }, [columns]);

  const getInsights = async (userMessage: string): Promise<void> => {
    if (!setLoading || !context?.agixt?.runChain || !context.overrides?.conversation || !context.agent) {
      console.error('Required dependencies for insights are not available');
      return;
    }

    setLoading(true);
    const stringifiedColumns = filteredColumns.map((header) => header.field);
    const stringifiedRows = filteredRows.map((row) =>
      [row.id, ...filteredColumns.map((header) => row[header.field])].join(
        separator.toString() === '/\\t/' ? '\t' : separator.toString(),
      ),
    );

    try {
      await context.agixt.runChain('Data Analysis', userMessage, context.agent, false, 1, {
        conversation_name: context.overrides.conversation,
        text: [
          ['id', ...stringifiedColumns].join(separator.toString() === '/\\t/' ? '\t' : separator.toString()),
          ...stringifiedRows,
        ].join('\n'),
      });
    } catch (error) {
      console.error('Error getting insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const tableColumns = React.useMemo(
    () =>
      filteredColumns.map((column) => ({
        accessorKey: column.field,
        header: column.headerName,
      })),
    [filteredColumns],
  );

  // Handle sorting
  const handleSort = (columnField: string) => {
    setSortConfig(
      sortConfig?.column === columnField && sortConfig.direction === 'asc'
        ? { column: columnField, direction: 'desc' }
        : { column: columnField, direction: 'asc' },
    );
  };

  // Handle filter change
  const handleFilterChange = (columnField: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [columnField]: value,
    }));
  };

  // Apply sorting and filtering
  useEffect(() => {
    let result = [...rows];

    // Apply filters
    Object.keys(filters).forEach((columnField) => {
      const filterValue = filters[columnField].toLowerCase();
      if (filterValue) {
        result = result.filter((row) => String(row[columnField]).toLowerCase().includes(filterValue));
      }
    });

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = String(a[sortConfig.column]);
        const bValue = String(b[sortConfig.column]);

        if (sortConfig.direction === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      });
    }

    setFilteredRows(result);
  }, [rows, filters, sortConfig]);

  return rows.length > 0 ? (
    <div className='flex flex-col gap-4'>
      {error ? (
        <p className='text-red-500'>{error}</p>
      ) : (
        <>
          <div className='overflow-x-auto'>
            <table className='w-full border-collapse text-sm'>
              <thead>
                <tr className='border-b'>
                  {filteredColumns.map((column) => (
                    <th key={column.field} scope='col' className='p-2 font-medium text-left bg-muted/50'>
                      <div className='flex flex-col gap-2'>
                        <button
                          onClick={() => handleSort(column.field)}
                          className='flex items-center gap-1 hover:text-foreground/70 focus:outline-none group w-full'
                        >
                          <span>{column.headerName}</span>
                          <span
                            className={`ml-1 transition-colors ${sortConfig?.column === column.field ? 'text-foreground' : 'text-foreground/50 group-hover:text-foreground/70'}`}
                          >
                            {sortConfig?.column === column.field ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </button>
                        <div className='relative'>
                          <input
                            type='text'
                            className='w-full rounded border border-input bg-background px-2 py-1 text-xs transition-colors hover:border-accent focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring'
                            placeholder={`Filter...`}
                            value={filters[column.field] || ''}
                            onChange={(e) => handleFilterChange(column.field, e.target.value)}
                          />
                          {filters[column.field] && (
                            <button
                              className='absolute right-2 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground/70'
                              onClick={() => handleFilterChange(column.field, '')}
                              aria-label='Clear filter'
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row, rowIndex) => (
                  <tr key={row.id} className='border-b hover:bg-muted/50'>
                    {filteredColumns.map((column) => (
                      <td key={`${row.id}-${column.field}`} className='border p-2'>
                        {row[column.field]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className='flex flex-wrap gap-4 items-center justify-between border-t border-border pt-4 text-sm'>
            <div className='flex items-center gap-2'>
              <label className='text-muted-foreground'>Show:</label>
              <select
                className='border rounded px-2 py-1 bg-background hover:bg-accent/50 focus:outline-none'
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              >
                {[5, 10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span className='text-muted-foreground'>
                {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredRows.length)} of{' '}
                {filteredRows.length}
              </span>
            </div>
            <div className='flex items-center gap-2'>
              <button
                className='px-2 py-1 border rounded transition-colors hover:bg-accent/50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed'
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                ←
              </button>
              <span className='text-muted-foreground'>
                Page {currentPage} of {Math.ceil(filteredRows.length / pageSize)}
              </span>
              <button
                className='px-2 py-1 border rounded transition-colors hover:bg-accent/50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed'
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === Math.ceil(filteredRows.length / pageSize)}
              >
                →
              </button>
            </div>
          </div>
          {setLoading && (
            <div className='mt-4'>
              <button
                className='flex items-center px-4 py-2 border border-blue-500 text-blue-500 rounded hover:bg-blue-100'
                onClick={() => setOpen(true)}
              >
                <LightBulbIcon className='w-5 h-5 mr-2' />
                Get Insights
              </button>
            </div>
          )}
          {open && (
            <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center'>
              <div className='bg-white p-6 rounded-lg'>
                <h2 className='text-xl font-bold mb-4'>Get Insights</h2>
                <input
                  className='w-full p-2 border rounded mb-4'
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  onClick={() => {
                    if (userMessage === 'Surprise me!') {
                      setUserMessage('');
                    }
                  }}
                  placeholder='What would you like insights on?'
                />
                <div className='flex justify-end'>
                  <button className='px-4 py-2 text-red-500 mr-2' onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button
                    className='px-4 py-2 bg-blue-500 text-white rounded'
                    onClick={() => {
                      getInsights(userMessage);
                      setOpen(false);
                    }}
                  >
                    Get Insights
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  ) : (
    <>{xsvData}</>
  );
};

export default RendererXSV;
