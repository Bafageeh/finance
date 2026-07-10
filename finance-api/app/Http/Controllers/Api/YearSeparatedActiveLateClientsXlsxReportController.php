<?php

namespace App\Http\Controllers\Api;

use Symfony\Component\HttpFoundation\Response;

class YearSeparatedActiveLateClientsXlsxReportController extends FormattedActiveLateClientsXlsxReportController
{
    private int $yearStyleOffset = 0;

    public function download(): Response
    {
        $response = parent::download();
        $content = $response->getContent();

        if (! is_string($content) || $content === '') {
            return $response;
        }

        $files = $this->extractStoredZip($content);

        if (! isset($files['xl/styles.xml'], $files['xl/worksheets/sheet1.xml'])) {
            return $response;
        }

        $files['xl/styles.xml'] = $this->addYearSeparatorStyles($files['xl/styles.xml']);
        $files['xl/worksheets/sheet1.xml'] = $this->applyYearSeparators($files['xl/worksheets/sheet1.xml']);

        $xlsx = $this->buildStoredZip($files);
        $response->setContent($xlsx);
        $response->headers->set('Content-Length', (string) strlen($xlsx));

        return $response;
    }

    private function addYearSeparatorStyles(string $styles): string
    {
        $newBorderId = 0;

        $styles = preg_replace_callback(
            '/<borders count="(\d+)">(.*?)<\/borders>/s',
            function (array $matches) use (&$newBorderId): string {
                $newBorderId = (int) $matches[1];

                $thickBorder = '<border>'
                    . '<left style="thin"><color rgb="FFE2E8F0"/></left>'
                    . '<right style="thin"><color rgb="FFE2E8F0"/></right>'
                    . '<top style="thin"><color rgb="FFE2E8F0"/></top>'
                    . '<bottom style="medium"><color rgb="FF334155"/></bottom>'
                    . '</border>';

                return '<borders count="' . ($newBorderId + 1) . '">'
                    . $matches[2]
                    . $thickBorder
                    . '</borders>';
            },
            $styles,
            1,
        ) ?? $styles;

        return preg_replace_callback(
            '/<cellXfs count="(\d+)">(.*?)<\/cellXfs>/s',
            function (array $matches) use ($newBorderId): string {
                preg_match_all('/<xf\b.*?<\/xf>/s', $matches[2], $xfs);
                $original = $xfs[0] ?? [];

                if ($original === []) {
                    return $matches[0];
                }

                $this->yearStyleOffset = count($original);

                $yearStyles = array_map(function (string $xf) use ($newBorderId): string {
                    if (preg_match('/borderId="\d+"/', $xf)) {
                        return preg_replace(
                            '/borderId="\d+"/',
                            'borderId="' . $newBorderId . '"',
                            $xf,
                            1,
                        ) ?? $xf;
                    }

                    return preg_replace(
                        '/<xf\b/',
                        '<xf borderId="' . $newBorderId . '" applyBorder="1"',
                        $xf,
                        1,
                    ) ?? $xf;
                }, $original);

                return '<cellXfs count="' . (count($original) * 2) . '">'
                    . $matches[2]
                    . implode('', $yearStyles)
                    . '</cellXfs>';
            },
            $styles,
            1,
        ) ?? $styles;
    }

    private function applyYearSeparators(string $sheet): string
    {
        if ($this->yearStyleOffset <= 0) {
            return $sheet;
        }

        return preg_replace_callback(
            '/<row r="(\d+)">(.*?)<\/row>/s',
            function (array $matches): string {
                $rowContent = $matches[2];

                $isDecember = preg_match(
                    '/<c r="A\d+"[^>]*>.*?<t[^>]*>\s*12\s*\/\s*\d{4}\s*<\/t>.*?<\/c>/s',
                    $rowContent,
                ) === 1;

                if (! $isDecember) {
                    return $matches[0];
                }

                $rowContent = preg_replace_callback(
                    '/s="(\d+)"/',
                    fn (array $style): string => 's="' . ((int) $style[1] + $this->yearStyleOffset) . '"',
                    $rowContent,
                ) ?? $rowContent;

                return '<row r="' . $matches[1] . '">' . $rowContent . '</row>';
            },
            $sheet,
        ) ?? $sheet;
    }

    private function extractStoredZip(string $zip): array
    {
        $files = [];
        $offset = 0;
        $length = strlen($zip);

        while ($offset + 30 <= $length) {
            $header = unpack(
                'Vsignature/vversion/vflags/vcompression/vmtime/vmdate/Vcrc/Vcompressed/Vuncompressed/vnameLength/vextraLength',
                substr($zip, $offset, 30),
            );

            if (! is_array($header) || ($header['signature'] ?? 0) !== 0x04034b50) {
                break;
            }

            $nameLength = (int) $header['nameLength'];
            $extraLength = (int) $header['extraLength'];
            $compressedSize = (int) $header['compressed'];
            $compression = (int) $header['compression'];

            if ($compression !== 0) {
                return [];
            }

            $nameOffset = $offset + 30;
            $dataOffset = $nameOffset + $nameLength + $extraLength;
            $name = substr($zip, $nameOffset, $nameLength);
            $files[$name] = substr($zip, $dataOffset, $compressedSize);
            $offset = $dataOffset + $compressedSize;
        }

        return $files;
    }

    private function buildStoredZip(array $files): string
    {
        $body = '';
        $directory = '';
        $offset = 0;
        $count = 0;

        foreach ($files as $name => $content) {
            $name = (string) $name;
            $content = (string) $content;
            $nameLength = strlen($name);
            $size = strlen($content);
            $crc = (int) sprintf('%u', crc32($content));
            $flags = 0x0800;

            $local = pack(
                'VvvvvvVVVvv',
                0x04034b50,
                20,
                $flags,
                0,
                0,
                0,
                $crc,
                $size,
                $size,
                $nameLength,
                0,
            ) . $name . $content;

            $directory .= pack(
                'VvvvvvvVVVvvvvvVV',
                0x02014b50,
                20,
                20,
                $flags,
                0,
                0,
                0,
                $crc,
                $size,
                $size,
                $nameLength,
                0,
                0,
                0,
                0,
                0,
                $offset,
            ) . $name;

            $body .= $local;
            $offset += strlen($local);
            $count++;
        }

        $directoryOffset = strlen($body);
        $body .= $directory;
        $body .= pack(
            'VvvvvVVv',
            0x06054b50,
            0,
            0,
            $count,
            $count,
            strlen($directory),
            $directoryOffset,
            0,
        );

        return $body;
    }
}
