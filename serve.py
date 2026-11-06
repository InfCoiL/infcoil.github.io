#!/usr/bin/env python3
"""Static preview server with byte ranges for HTML video seeking."""
import argparse,os,re
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from functools import partial

class Handler(SimpleHTTPRequestHandler):
    def send_head(self):
        self.remaining=None
        path=self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().send_head()
        try:
            handle=open(path,'rb')
        except OSError:
            self.send_error(404);return None
        size=os.fstat(handle.fileno()).st_size
        start,end=0,size-1
        range_header=self.headers.get('Range')
        if range_header:
            m=re.fullmatch(r'bytes=(\d*)-(\d*)',range_header)
            if not m or not any(m.groups()):
                handle.close();self.send_error(400,'Invalid Range');return None
            if m[1]:
                start=int(m[1]);end=min(int(m[2]),size-1) if m[2] else size-1
            else:
                start=max(0,size-int(m[2]))
            if start>=size or end<start:
                handle.close();self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.send_header('Content-Length','0');self.end_headers();return None
            self.send_response(206);self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
        else:
            self.send_response(200)
        self.send_header('Content-Type',self.guess_type(path));self.send_header('Accept-Ranges','bytes')
        self.send_header('Content-Length',str(max(0,end-start+1)));self.send_header('Last-Modified',self.date_time_string(os.fstat(handle.fileno()).st_mtime));self.end_headers()
        handle.seek(start);self.remaining=max(0,end-start+1);return handle
    def copyfile(self,source,outputfile):
        if self.remaining is None:return super().copyfile(source,outputfile)
        try:
            while self.remaining:
                block=source.read(min(65536,self.remaining))
                if not block:break
                outputfile.write(block);self.remaining-=len(block)
        except (BrokenPipeError,ConnectionResetError):pass

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8766);p.add_argument('--directory',default='.');a=p.parse_args()
    with ThreadingHTTPServer(('127.0.0.1',a.port),partial(Handler,directory=a.directory)) as server:
        print(f'Serving {a.directory} at http://127.0.0.1:{a.port}',flush=True);server.serve_forever()
