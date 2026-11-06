import os
bind = '0.0.0.0:' + os.environ.get('PORT', '10000')
workers = 1  # One persistent-disk SQLite service; sessions and rate limits share this process.
threads = 4
timeout = 60
accesslog = None  # Do not log request headers, tokens, query strings or applicant data.
errorlog = '-'
loglevel = 'warning'
limit_request_line = 4094
limit_request_fields = 40
limit_request_field_size = 4094
