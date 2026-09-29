Pod::Spec.new do |s|
  s.name           = 'PerfSampler'
  s.version        = '1.0.0'
  s.summary        = 'Coleta de CPU, memoria e FPS do estudo de desempenho do TCC'
  s.description    = 'Coleta de CPU, memoria e FPS do estudo de desempenho do TCC'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1'
  }
  s.swift_version  = '5.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = "**/*.{h,m,swift}"
end
