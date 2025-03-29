import React, { useEffect, useRef, useState } from 'react';
import { JSONEditor } from 'vanilla-jsoneditor';
import * as mcpService from '../../services/mcpService';
import { MCPConfig } from '../../types/mcp';

interface ConfigJsonEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

const ConfigJsonEditor: React.FC<ConfigJsonEditorProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<MCPConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const jsonEditorRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen && editorRef.current) {
      loadConfig();
    }

    return () => {
      if (jsonEditorRef.current) {
        jsonEditorRef.current.destroy();
        jsonEditorRef.current = null;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (config && editorRef.current) {
      if (jsonEditorRef.current) {
        jsonEditorRef.current.destroy();
      }

      jsonEditorRef.current = new JSONEditor({
        target: editorRef.current,
        props: {
          content: {
            json: config
          },
          mode: 'text',
          mainMenuBar: true,
          navigationBar: true,
          statusBar: true
        }
      });
    }
  }, [config]);

  const loadConfig = async () => {
    try {
      setError(null);
      const loadedConfig = await mcpService.getMCPConfig();
      setConfig(loadedConfig);
    } catch (err: any) {
      setError(err?.message || 'Failed to load configuration');
      console.error('Error loading configuration:', err);
    }
  };

  const handleSave = async () => {
    if (!jsonEditorRef.current) return;

    try {
      setIsSaving(true);
      setError(null);

      const content = jsonEditorRef.current.get();
      let jsonData;
      
      if (content.json) {
        jsonData = content.json;
      } else if (content.text) {
        try {
          jsonData = JSON.parse(content.text);
        } catch (err) {
          throw new Error('Invalid JSON format');
        }
      } else {
        throw new Error('No content to save');
      }

      await mcpService.saveMCPConfig(jsonData);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save configuration');
      console.error('Error saving configuration:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '1000px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '1rem',
          borderBottom: '1px solid #eee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Configuration JSON</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.25rem'
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            margin: '0.5rem 1rem',
            borderRadius: '4px'
          }}>
            {error}
          </div>
        )}

        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '1rem',
          minHeight: '400px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
            <button
              onClick={() => {
                if (jsonEditorRef.current) {
                  const content = jsonEditorRef.current.get();
                  let jsonString;
                  
                  if (content.json) {
                    jsonString = JSON.stringify(content.json, null, 2);
                  } else if (content.text) {
                    jsonString = content.text;
                  }
                  
                  if (jsonString) {
                    navigator.clipboard.writeText(jsonString)
                      .then(() => {
                        // Could add a toast notification here
                        console.log('JSON copied to clipboard');
                      })
                      .catch(err => {
                        console.error('Failed to copy JSON:', err);
                      });
                  }
                }
              }}
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                border: '1px solid #ccc',
                background: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem'
              }}
            >
              Copy to Clipboard
            </button>
          </div>
          <div ref={editorRef} style={{ height: '100%' }}></div>
        </div>

        <div style={{
          padding: '1rem',
          borderTop: '1px solid #eee',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.5rem'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              border: '1px solid #ccc',
              background: 'none',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              border: '1px solid #0284c7',
              backgroundColor: '#0284c7',
              color: 'white',
              cursor: isSaving ? 'wait' : 'pointer',
              opacity: isSaving ? 0.7 : 1
            }}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigJsonEditor;
