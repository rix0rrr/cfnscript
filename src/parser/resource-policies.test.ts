import { Compiler, Decompiler } from '../compiler/Compiler';

describe('Resource policies', () => {
  describe('DeletionPolicy', () => {
    it('should accept Delete', () => {
      const cfnscript = `
        MyBucket = Resource AWS::S3::Bucket {
          BucketName: "test"
        } DeletionPolicy(Delete)
      `;
      
      const compiler = new Compiler();
      const result = compiler.compile(cfnscript);
      
      expect(result.Resources.MyBucket.DeletionPolicy).toBe('Delete');
    });

    it('should accept Retain', () => {
      const cfnscript = `
        MyBucket = Resource AWS::S3::Bucket {
          BucketName: "test"
        } DeletionPolicy(Retain)
      `;
      
      const compiler = new Compiler();
      const result = compiler.compile(cfnscript);
      
      expect(result.Resources.MyBucket.DeletionPolicy).toBe('Retain');
    });

    it('should accept RetainExceptOnCreate', () => {
      const cfnscript = `
        MyBucket = Resource AWS::S3::Bucket {
          BucketName: "test"
        } DeletionPolicy(RetainExceptOnCreate)
      `;
      
      const compiler = new Compiler();
      const result = compiler.compile(cfnscript);
      
      expect(result.Resources.MyBucket.DeletionPolicy).toBe('RetainExceptOnCreate');
    });

    it('should accept Snapshot', () => {
      const cfnscript = `
        MyBucket = Resource AWS::S3::Bucket {
          BucketName: "test"
        } DeletionPolicy(Snapshot)
      `;
      
      const compiler = new Compiler();
      const result = compiler.compile(cfnscript);
      
      expect(result.Resources.MyBucket.DeletionPolicy).toBe('Snapshot');
    });

    it('should reject invalid policy value', () => {
      const cfnscript = `
        MyBucket = Resource AWS::S3::Bucket {
          BucketName: "test"
        } DeletionPolicy(InvalidPolicy)
      `;
      
      const compiler = new Compiler();
      
      expect(() => compiler.compile(cfnscript)).toThrow(
        "Invalid DeletionPolicy value 'InvalidPolicy'. Must be one of: Delete, Retain, RetainExceptOnCreate, Snapshot"
      );
    });

    it('should roundtrip correctly', () => {
      const original = {
        Resources: {
          MyBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: { BucketName: 'test' },
            DeletionPolicy: 'Retain'
          }
        }
      };

      const decompiler = new Decompiler();
      const cfnscript = decompiler.decompile(original);
      
      expect(cfnscript).toContain('DeletionPolicy(Retain)');

      const compiler = new Compiler();
      const recompiled = compiler.compile(cfnscript);
      
      expect(recompiled.Resources.MyBucket.DeletionPolicy).toBe('Retain');
    });
  });

  describe('UpdateReplacePolicy', () => {
    it('should accept Delete', () => {
      const cfnscript = `
        MyBucket = Resource AWS::S3::Bucket {
          BucketName: "test"
        } UpdateReplacePolicy(Delete)
      `;
      
      const compiler = new Compiler();
      const result = compiler.compile(cfnscript);
      
      expect(result.Resources.MyBucket.UpdateReplacePolicy).toBe('Delete');
    });

    it('should accept Retain', () => {
      const cfnscript = `
        MyBucket = Resource AWS::S3::Bucket {
          BucketName: "test"
        } UpdateReplacePolicy(Retain)
      `;
      
      const compiler = new Compiler();
      const result = compiler.compile(cfnscript);
      
      expect(result.Resources.MyBucket.UpdateReplacePolicy).toBe('Retain');
    });

    it('should accept Snapshot', () => {
      const cfnscript = `
        MyBucket = Resource AWS::S3::Bucket {
          BucketName: "test"
        } UpdateReplacePolicy(Snapshot)
      `;
      
      const compiler = new Compiler();
      const result = compiler.compile(cfnscript);
      
      expect(result.Resources.MyBucket.UpdateReplacePolicy).toBe('Snapshot');
    });

    it('should reject RetainExceptOnCreate', () => {
      const cfnscript = `
        MyBucket = Resource AWS::S3::Bucket {
          BucketName: "test"
        } UpdateReplacePolicy(RetainExceptOnCreate)
      `;
      
      const compiler = new Compiler();
      
      expect(() => compiler.compile(cfnscript)).toThrow(
        "Invalid UpdateReplacePolicy value 'RetainExceptOnCreate'. Must be one of: Delete, Retain, Snapshot"
      );
    });

    it('should reject invalid policy value', () => {
      const cfnscript = `
        MyBucket = Resource AWS::S3::Bucket {
          BucketName: "test"
        } UpdateReplacePolicy(InvalidPolicy)
      `;
      
      const compiler = new Compiler();
      
      expect(() => compiler.compile(cfnscript)).toThrow(
        "Invalid UpdateReplacePolicy value 'InvalidPolicy'. Must be one of: Delete, Retain, Snapshot"
      );
    });

    it('should roundtrip correctly', () => {
      const original = {
        Resources: {
          MyBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: { BucketName: 'test' },
            UpdateReplacePolicy: 'Snapshot'
          }
        }
      };

      const decompiler = new Decompiler();
      const cfnscript = decompiler.decompile(original);
      
      expect(cfnscript).toContain('UpdateReplacePolicy(Snapshot)');

      const compiler = new Compiler();
      const recompiled = compiler.compile(cfnscript);
      
      expect(recompiled.Resources.MyBucket.UpdateReplacePolicy).toBe('Snapshot');
    });
  });

  describe('Combined policies', () => {
    it('should handle both policies on same resource', () => {
      const cfnscript = `
        MyBucket = Resource AWS::S3::Bucket {
          BucketName: "test"
        } DeletionPolicy(Retain) UpdateReplacePolicy(Snapshot)
      `;
      
      const compiler = new Compiler();
      const result = compiler.compile(cfnscript);
      
      expect(result.Resources.MyBucket.DeletionPolicy).toBe('Retain');
      expect(result.Resources.MyBucket.UpdateReplacePolicy).toBe('Snapshot');
    });
  });
});
