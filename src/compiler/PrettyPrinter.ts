export class PrettyPrinter {
  private indentSize = 2;

  format(code: string): string {
    const lines = code.split('\n\n');
    return lines.map(line => this.formatStatement(line)).join('\n\n');
  }

  private formatStatement(statement: string): string {
    // Check if it's an assignment with a complex value
    const assignmentMatch = statement.match(/^(\w+)\s*=\s*(.+)$/);
    if (assignmentMatch) {
      const [, name, value] = assignmentMatch;
      const formattedValue = this.formatValue(value, 0);
      return `${name} = ${formattedValue}`;
    }
    
    // Otherwise format as a simple statement
    return this.formatValue(statement, 0);
  }

  private formatValue(value: string, depth: number): string {
    value = value.trim();
    
    // Find and format objects in the value
    return this.formatObjects(value, depth);
  }

  private formatObjects(text: string, depth: number): string {
    let result = '';
    let i = 0;
    let inString = false;
    let stringChar = '';
    
    while (i < text.length) {
      const char = text[i];
      
      // Track string boundaries
      if ((char === '"' || char === "'") && (i === 0 || text[i - 1] !== '\\')) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }
      
      // Only format braces outside of strings
      if (!inString && char === '{') {
        // Find the matching closing brace
        const objEnd = this.findMatchingBrace(text, i);
        if (objEnd !== -1) {
          const obj = text.substring(i, objEnd + 1);
          result += this.formatObject(obj, depth);
          i = objEnd + 1;
          continue;
        }
      }
      
      result += char;
      i++;
    }
    
    return result;
  }

  private findMatchingBrace(text: string, start: number): number {
    let depth = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      
      if ((char === '"' || char === "'") && (i === 0 || text[i - 1] !== '\\')) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }
      
      if (!inString) {
        if (char === '{') depth++;
        if (char === '}') {
          depth--;
          if (depth === 0) return i;
        }
      }
    }
    
    return -1;
  }

  private formatObject(obj: string, depth: number): string {
    obj = obj.trim();
    
    if (!obj.startsWith('{') || !obj.endsWith('}')) {
      return obj;
    }
    
    const content = obj.slice(1, -1).trim();
    if (!content) return '{}';
    
    const properties = this.parseObjectProperties(content);
    
    // Check if any property value contains escaped newlines - if so, don't format
    const hasEscapedNewlines = properties.some(p => p.value.includes('\\n'));
    if (hasEscapedNewlines) {
      return obj; // Return as-is to avoid breaking string literals
    }
    
    // If object is simple, keep it on one line
    const hasComplexValues = properties.some(p => 
      p.value.includes('{') || p.value.includes('[') || p.value.length > 60
    );
    
    if (!hasComplexValues && properties.length <= 3 && content.length < 80) {
      return `{ ${properties.map(p => `${p.key}: ${p.value}`).join(', ')} }`;
    }
    
    // Multi-line format
    const indent = ' '.repeat((depth + 1) * this.indentSize);
    const closeIndent = ' '.repeat(depth * this.indentSize);
    
    const formattedProps = properties.map(p => {
      const formattedValue = this.formatObjects(p.value, depth + 1);
      return `${indent}${p.key}: ${formattedValue}`;
    });
    
    return `{\n${formattedProps.join(',\n')}\n${closeIndent}}`;
  }

  private parseObjectProperties(content: string): Array<{ key: string; value: string }> {
    const properties: Array<{ key: string; value: string }> = [];
    let current = '';
    let braceDepth = 0;
    let bracketDepth = 0;
    let parenDepth = 0;
    let inString = false;
    let stringChar = '';
    let key = '';
    let inKey = true;
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      
      if ((char === '"' || char === "'") && (i === 0 || content[i - 1] !== '\\')) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }
      
      if (!inString) {
        if (char === '{') braceDepth++;
        if (char === '}') braceDepth--;
        if (char === '[') bracketDepth++;
        if (char === ']') bracketDepth--;
        if (char === '(') parenDepth++;
        if (char === ')') parenDepth--;
        
        if (char === ':' && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0 && inKey) {
          key = current.trim();
          current = '';
          inKey = false;
          continue;
        }
        
        if (char === ',' && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
          properties.push({ key, value: current.trim() });
          current = '';
          key = '';
          inKey = true;
          continue;
        }
      }
      
      current += char;
    }
    
    if (current.trim() && key) {
      properties.push({ key, value: current.trim() });
    }
    
    return properties;
  }
}
