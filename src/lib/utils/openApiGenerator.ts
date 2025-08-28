import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  tags: Array<{
    name: string;
    description?: string;
    'x-order'?: number;
  }>;
  components: {
    securitySchemes: {
      apiKey: {
        type: string;
        in: string;
        name: string;
        description: string;
      };
    };
    schemas?: Record<string, any>;
    responses?: Record<string, any>;
  };
  paths: Record<string, any>;
}

export class OpenAPIGenerator {
  private baseSpec: OpenAPISpec = {
    openapi: '3.0.0',
    info: {
      title: 'Ontology API Documentation',
      version: '1.0.0',
      description: 'API documentation for Ontology'
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    tags: [],
    components: {
      securitySchemes: {
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API key authentication'
        }
      },
      schemas: {},
      responses: {}
    },
    paths: {}
  };

  constructor(private apiDirectory: string) {}

  private mergeTags(newTags: Array<any> = []) {
    if (!newTags?.length) return;

    newTags.forEach(newTag => {
      const existingTag = this.baseSpec.tags.find(t => t.name === newTag.name);
      if (!existingTag) {
        this.baseSpec.tags.push(newTag);
      } else if (newTag.description && !existingTag.description) {
        existingTag.description = newTag.description;
      }
    });

    // Sort tags by x-order if present
    this.baseSpec.tags.sort((a, b) => {
      const orderA = a['x-order'] || Infinity;
      const orderB = b['x-order'] || Infinity;
      return orderA - orderB;
    });
  }

  private mergeComponents(parsed: any) {
    if (parsed.components) {
      // Merge schemas
      if (parsed.components.schemas) {
        this.baseSpec.components.schemas = {
          ...this.baseSpec.components.schemas,
          ...parsed.components.schemas
        };
      }
      
      // Merge responses
      if (parsed.components.responses) {
        this.baseSpec.components.responses = {
          ...this.baseSpec.components.responses,
          ...parsed.components.responses
        };
      }
    }
  }

  private extractOpenAPIContent(docContent: string): string {
    if (!docContent.includes('@openapi')) {
      return '';
    }

    return docContent
      .split('@openapi')[1]
      .split('\n')
      .map(line => line.replace(/^\s*\*\s?/, ''))
      .filter(line => line.trim() !== '')
      .join('\n')
      .trim();
  }

  private processFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const docRegex = /\/\*\*([\s\S]*?)\*\//g;
      
      let match;
      while ((match = docRegex.exec(content)) !== null) {
        const yamlContent = this.extractOpenAPIContent(match[1]);
        if (!yamlContent) continue;

        try {
          const parsed = yaml.load(yamlContent) as Record<string, any>;
          
          // Handle tags
          if (Array.isArray(parsed.tags)) {
            this.mergeTags(parsed.tags);
            delete parsed.tags;
          }

          // Handle components
          this.mergeComponents(parsed);
          if (parsed.components) {
            delete parsed.components;
          }

          // Handle paths
          if (Object.keys(parsed).length > 0) {
            const pathKey = Object.keys(parsed)[0];
            if (!this.baseSpec.paths[pathKey]) {
              this.baseSpec.paths[pathKey] = {};
            }
            // Merge the HTTP methods for this path
            this.baseSpec.paths[pathKey] = {
              ...this.baseSpec.paths[pathKey],
              ...parsed[pathKey]
            };
          }
        } catch (yamlError) {
          console.error(`YAML parsing error in ${filePath}:`, yamlError);
          console.error('Problematic YAML content:', yamlContent);
        }
      }
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    }
  }

  private getAllFiles(dir: string): string[] {
    const files: string[] = [];
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...this.getAllFiles(fullPath));
      } else if (item.endsWith('.ts') && !item.endsWith('.d.ts') && !item.endsWith('.test.ts')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  public async generateSpec(): Promise<OpenAPISpec> {
    try {
      const apiFiles = this.getAllFiles(this.apiDirectory);


      for (const file of apiFiles) {
        this.processFile(file);
      }

      // Remove empty objects from components
      if (Object.keys(this.baseSpec.components.schemas || {}).length === 0) {
        delete this.baseSpec.components.schemas;
      }
      if (Object.keys(this.baseSpec.components.responses || {}).length === 0) {
        delete this.baseSpec.components.responses;
      }

      return this.baseSpec;
    } catch (error) {
      console.error('Error generating spec:', error);
      throw error;
    }
  }
}