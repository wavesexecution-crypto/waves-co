\ = [IO.File]::ReadAllText('D:\waves-co\app\site.ts') 
\ = \ -replace 'Wavesco', 'WAVES' 
\ = \ -replace 'Systems Architecture for Founder-Led Companies', 'Your business. Made easier.' 
\ = \ -replace 'Systems architecture for founder-led companies that need work to move without constant founder involvement.', 'WAVES handles the work behind your business, from finding customers to running day-to-day operations.' 
[IO.File]::WriteAllText('D:\waves-co\app\site.ts', \, [System.Text.Encoding]::UTF8) 
