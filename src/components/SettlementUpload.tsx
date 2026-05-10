import { useState, useRef } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, Download, X } from 'lucide-react';
import { callEdgeFunction } from '../lib/supabase';
import toast from 'react-hot-toast';

interface Props {
  brandId: string;
  onComplete: () => void;
}

export default function SettlementUpload({ brandId, onComplete }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [marketplace, setMarketplace] = useState('amazon');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): any[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] || ''; });
      return row;
    });
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        toast.error('CSV file is empty or invalid');
        setLoading(false);
        return;
      }

      const res = await callEdgeFunction('parseSettlement', {
        brand_id: brandId,
        file_name: file.name,
        file_type: 'settlement',
        marketplace,
        settlement_period: period,
        rows,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        setResult(res);
        toast.success(`Parsed ${res.inserted} transactions from ${res.total_rows} rows`);
        onComplete();
      }
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    }
    setLoading(false);
  };

  const downloadSample = () => {
    window.open('/sample_settlement.csv', '_blank');
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase flex items-center gap-2">
          <Upload size={16} />
          Upload Settlement File
        </h3>
        <button onClick={downloadSample} className="text-xs text-maroon-700 hover:underline flex items-center gap-1">
          <Download size={12} /> Download Sample CSV
        </button>
      </div>

      <div className="space-y-4">
        {/* File Input */}
        <div
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${file ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-maroon-300 hover:bg-maroon-50/10'}`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={e => { setFile(e.target.files?.[0] || null); setResult(null); }}
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText size={24} className="text-green-600" />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={e => { e.stopPropagation(); setFile(null); setResult(null); }} className="text-gray-400 hover:text-red-500 ml-2">
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <Upload size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Click to upload settlement CSV</p>
              <p className="text-xs text-gray-400 mt-1">Supports .csv files with order_id, amount, commission columns</p>
            </>
          )}
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Marketplace</label>
            <select value={marketplace} onChange={e => setMarketplace(e.target.value)} className="input-field text-sm">
              <option value="amazon">Amazon</option>
              <option value="flipkart">Flipkart</option>
              <option value="meesho">Meesho</option>
              <option value="myntra">Myntra</option>
              <option value="ajio">AJIO</option>
              <option value="nykaa">Nykaa</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Settlement Period</label>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="input-field text-sm" />
          </div>
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="btn-maroon w-full flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {loading ? 'Parsing...' : 'Upload & Parse'}
        </button>

        {/* Result */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={16} className="text-green-600" />
              <span className="text-sm font-medium text-green-700">Settlement Parsed Successfully</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-gray-900">{result.total_rows}</p>
                <p className="text-xs text-gray-500">Total Rows</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">{result.inserted}</p>
                <p className="text-xs text-gray-500">Inserted</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-600">{result.status}</p>
                <p className="text-xs text-gray-500">Status</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
